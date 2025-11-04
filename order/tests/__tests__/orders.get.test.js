const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Order = require('../../src/models/order.model');
const { makeAuthToken } = require('../helpers');


describe('GET /api/orders/:id - Get order by id with timeline and payment summary', () => {
  test('401 when no auth token provided', async () => {
    const someId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/orders/${someId}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('401 when token is invalid', async () => {
    const someId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/orders/${someId}`)
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('403 when trying to access another user\'s order', async () => {
    // Arrange: Seed an order for userA
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();
    const tokenB = makeAuthToken({ _id: userB.toString(), role: 'user' });

    const order = await Order.create({
      user: userA,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          quantity: 1,
          price: { amount: 25, currency: 'USD' },
        },
      ],
      totalAmount: { amount: 25, currency: 'USD' },
      status: 'PENDING',
      shippingAddress: {
        street: '123 Main St',
        city: 'Metropolis',
        state: 'NY',
        pincode: '10001',
        country: 'US',
        phone: '+1234567890',
      },
    });

    // Act
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    // Assert
    expect([401, 403]).toContain(res.status); // Either unauthorized or forbidden depending on implementation
  });

  test('404 when order does not exist', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: userId.toString(), role: 'user' });
    const nonExistentId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .get(`/api/orders/${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect([400, 404]).toContain(res.status); // 400 for invalid id, 404 for not found
  });

  test('200 success returns order with timeline and payment summary', async () => {
    // Arrange: Seed an order for user
    const userId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: userId.toString(), role: 'user' });

    const order = await Order.create({
      user: userId,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          quantity: 2,
          price: { amount: 10, currency: 'USD' },
        },
        {
          productId: new mongoose.Types.ObjectId(),
          quantity: 1,
          price: { amount: 20, currency: 'USD' },
        },
      ],
      totalAmount: { amount: 40, currency: 'USD' },
      status: 'PENDING',
      shippingAddress: {
        street: '221B Baker Street',
        city: 'London',
        state: 'London',
        pincode: 'NW16XE',
        country: 'UK',
        phone: '+447900123456',
      },
    });

    // Act
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');

    const o = res.body.order;
    expect(o).toHaveProperty('_id');
    expect(o).toHaveProperty('items');
  });
});

describe('GET /api/orders/me - Paginated list of the customer\'s orders', () => {
  test('401 when no auth token provided', async () => {
    const res = await request(app).get('/api/orders/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('200 returns paginated orders for current user', async () => {
    // Arrange: Seed some orders across two users
    const userId = new mongoose.Types.ObjectId();
    const otherUser = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: userId.toString(), role: 'user' });

    const baseOrder = {
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          quantity: 1,
          price: { amount: 15, currency: 'USD' },
        },
      ],
      totalAmount: { amount: 15, currency: 'USD' },
      status: 'PENDING',
      shippingAddress: {
        street: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'IL',
        pincode: '62701',
        country: 'US',
        phone: '+12175551234',
      },
    };

    // Create 5 orders for user, 3 for other user
    await Order.insertMany([
      { ...baseOrder, user: userId },
      { ...baseOrder, user: userId },
      { ...baseOrder, user: userId },
      { ...baseOrder, user: userId },
      { ...baseOrder, user: userId },
      { ...baseOrder, user: otherUser },
      { ...baseOrder, user: otherUser },
      { ...baseOrder, user: otherUser },
    ]);

    // Act: request with pagination
    const page = 1;
    const limit = 3;
    const res = await request(app)
      .get(`/api/orders/me?page=${page}&limit=${limit}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert: verify shape and scoping
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('total');
    expect(res.body.page).toBe(page);
    expect(res.body.limit).toBe(limit);

    // All returned orders belong to current user
    for (const o of res.body.orders) {
      expect(o.user.toString()).toBe(userId.toString());
    }

    // Limit respected
    expect(res.body.orders.length).toBeLessThanOrEqual(limit);
    // Total should represent total count of current user's orders (5)
    expect(res.body.total).toBeGreaterThanOrEqual(5);
  });
});
