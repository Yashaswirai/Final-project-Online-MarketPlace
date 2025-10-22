const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Order = require('../../src/models/order.model');
const { makeAuthToken } = require('../helpers');

describe('GET /api/orders/:id/cancel - Buyer-initiated cancel while pending', () => {
  test('401 when no auth token provided', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/orders/${id}/cancel`).send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('401 when token is invalid', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/orders/${id}/cancel`)
      .set('Authorization', 'Bearer invalid.token')
      .send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('404 when order not found', async () => {
    const token = makeAuthToken({ _id: new mongoose.Types.ObjectId().toString(), role: 'user' });
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/orders/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 404]).toContain(res.status);
  });

  test('403 when trying to cancel someone else\'s order', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const otherId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: otherId.toString(), role: 'user' });

    const order = await Order.create({
      user: ownerId,
      items: [
        { productId: new mongoose.Types.ObjectId(), quantity: 1, price: { amount: 10, currency: 'USD' } }
      ],
      totalAmount: 10,
      status: 'PENDING',
      shippingAddress: {
        street: 'A', city: 'B', state: 'C', pincode: '00000', country: 'US', phone: '+10000000000'
      }
    });

    const res = await request(app)
      .get(`/api/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect([401, 403]).toContain(res.status);
  });

  test('409 when order is not in PENDING status', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: userId.toString(), role: 'user' });
    const order = await Order.create({
      user: userId,
      items: [
        { productId: new mongoose.Types.ObjectId(), quantity: 1, price: { amount: 10, currency: 'USD' } }
      ],
      totalAmount: 10,
      status: 'SHIPPED',
      shippingAddress: {
        street: 'A', city: 'B', state: 'C', pincode: '00000', country: 'US', phone: '+10000000000'
      }
    });

    const res = await request(app)
      .get(`/api/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect([400, 409]).toContain(res.status);
  });

  test('200 success sets status=CANCELLED and returns updated order', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: userId.toString(), role: 'user' });
    const order = await Order.create({
      user: userId,
      items: [
        { productId: new mongoose.Types.ObjectId(), quantity: 1, price: { amount: 10, currency: 'USD' } }
      ],
      totalAmount: 10,
      status: 'PENDING',
      shippingAddress: {
        street: 'A', city: 'B', state: 'C', pincode: '00000', country: 'US', phone: '+10000000000'
      }
    });

    const res = await request(app)
      .get(`/api/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
    expect(String(res.body.order._id)).toBe(String(order._id));
    expect(String(res.body.order.user)).toBe(String(userId));
    expect(String(res.body.order.status).toUpperCase()).toBe('CANCELLED');
  });
});

describe('POST /api/orders/:id/address - Attach/update delivery address prior to payment capture', () => {
  test('401 when no auth token provided', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app).post(`/api/orders/${id}/address`).send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('401 when token is invalid', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/orders/${id}/address`)
      .set('Authorization', 'Bearer invalid')
      .send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('400 when shippingAddress is invalid', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: userId.toString(), role: 'user' });
    const order = await Order.create({
      user: userId,
      items: [ { productId: new mongoose.Types.ObjectId(), quantity: 1, price: { amount: 10, currency: 'USD' } } ],
      totalAmount: 10,
      status: 'PENDING',
      shippingAddress: { street: 'x', city: 'y', state: 'z', pincode: '12345', country: 'US', phone: '+10000000000' }
    });

    const res = await request(app)
      .post(`/api/orders/${order._id}/address`)
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: { street: '', city: '', state: '', pincode: '', country: '', phone: '' } });

    expect([400, 422]).toContain(res.status);
  });

  test('403 when trying to update someone else\'s order address', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const otherId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: otherId.toString(), role: 'user' });
    const order = await Order.create({
      user: ownerId,
      items: [ { productId: new mongoose.Types.ObjectId(), quantity: 1, price: { amount: 10, currency: 'USD' } } ],
      totalAmount: 10,
      status: 'PENDING',
      shippingAddress: { street: 'x', city: 'y', state: 'z', pincode: '12345', country: 'US', phone: '+10000000000' }
    });

    const res = await request(app)
      .post(`/api/orders/${order._id}/address`)
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: { street: '12 Main', city: 'Town', state: 'ST', pincode: '99999', country: 'US', phone: '+19999999999' } });

    expect([401, 403]).toContain(res.status);
  });

  test('409 when order is not in PENDING status', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: userId.toString(), role: 'user' });
    const order = await Order.create({
      user: userId,
      items: [ { productId: new mongoose.Types.ObjectId(), quantity: 1, price: { amount: 10, currency: 'USD' } } ],
      totalAmount: 10,
      status: 'CONFIRMED',
      shippingAddress: { street: 'x', city: 'y', state: 'z', pincode: '12345', country: 'US', phone: '+10000000000' }
    });

    const res = await request(app)
      .post(`/api/orders/${order._id}/address`)
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: { street: '12 Main', city: 'Town', state: 'ST', pincode: '99999', country: 'US', phone: '+19999999999' } });

    expect([400, 409]).toContain(res.status);
  });

  test('200 success updates and returns shippingAddress', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeAuthToken({ _id: userId.toString(), role: 'user' });
    const order = await Order.create({
      user: userId,
      items: [ { productId: new mongoose.Types.ObjectId(), quantity: 1, price: { amount: 10, currency: 'USD' } } ],
      totalAmount: 10,
      status: 'PENDING',
      shippingAddress: { street: 'x', city: 'y', state: 'z', pincode: '12345', country: 'US', phone: '+10000000000' }
    });

    const newAddress = { street: '12 Main', city: 'Town', state: 'ST', pincode: '99999', country: 'US', phone: '+19999999999' };
    const res = await request(app)
      .post(`/api/orders/${order._id}/address`)
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: newAddress });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
    expect(res.body.order).toHaveProperty('shippingAddress');
    expect(res.body.order.shippingAddress).toEqual(expect.objectContaining(newAddress));
  });
});
