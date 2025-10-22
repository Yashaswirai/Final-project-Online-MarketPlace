const request = require('supertest');
const express = require('express');
const http = require('http');
const app = require('../../src/app');
const mongoose = require('mongoose');
const { makeAuthToken } = require('../helpers');

// Spin up lightweight stub servers for Cart (3002) and Product (3001) services
let cartServer, productServer;
let productPort, cartPort;
let productData = {};
let cartItems = [];

beforeAll(async () => {
  // Product Service stub
  const productApp = express();
  productApp.use(express.json());
  productApp.get('/api/products/:id', (req, res) => {
    const id = req.params.id;
    const p = productData[id];
    if (!p) return res.status(404).json({ message: 'Not found' });
    // Return in shape { product: { ... } }
    res.json({ product: p });
  });
  productServer = http.createServer(productApp);
  await new Promise((resolve) => productServer.listen(0, resolve));
  productPort = productServer.address().port;

  // Cart Service stub
  const cartApp = express();
  cartApp.use(express.json());
  cartApp.get('/api/cart', (req, res) => {
    res.json({ cart: { items: cartItems } });
  });
  cartServer = http.createServer(cartApp);
  await new Promise((resolve) => cartServer.listen(0, resolve));
  cartPort = cartServer.address().port;

  // Provide base URLs for the controller under test
  process.env.PRODUCT_SERVICE_URL = `http://localhost:${productPort}`;
  process.env.CART_SERVICE_URL = `http://localhost:${cartPort}`;
});

afterAll(async () => {
  if (productServer) await new Promise((r) => productServer.close(r));
  if (cartServer) await new Promise((r) => cartServer.close(r));
});


describe('POST /api/orders - Create order from current cart', () => {
  test('401 when no auth token provided', async () => {
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('403 when user role is not authorized', async () => {
    const token = makeAuthToken({ _id: new mongoose.Types.ObjectId().toString(), role: 'guest' });
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('message');
  });

  test('401 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('400 when cart is empty or missing required fields', async () => {
    const token = makeAuthToken({ _id: new mongoose.Types.ObjectId().toString(), role: 'user' });
    // Configure stub cart to be empty
    cartItems = [];

    // Without body
    const res1 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res1.statusCode).toBe(400);
    expect(res1.body).toHaveProperty(['errors']);
  });

  test('201 success: copies priced items, computes totals, sets status=PENDING (happy path)', async () => {
    // Arrange: Build a plausible payload representing cart selection + address
    const token = makeAuthToken({ _id: new mongoose.Types.ObjectId().toString(), role: 'user' });

    const payload = {
      // Could be empty if derived from user cart in service, included here as an example
      shippingAddress: {
        street: '221B Baker Street',
        city: 'London',
        state: 'London',
        pincode: 'NW16XE',
        country: 'UK',
        phone: '+447900123456',
      },
    };

    // Configure stub services
    const productId1 = new mongoose.Types.ObjectId().toString();
    const productId2 = new mongoose.Types.ObjectId().toString();
    productData = {
      [productId1]: { _id: productId1, price: { amount: 10, currency: 'USD' } },
      [productId2]: { _id: productId2, price: { amount: 20, currency: 'USD' } },
    };
    cartItems = [
      { productId: productId1, quantity: 2 },
      { productId: productId2, quantity: 1 },
    ];

    // Act
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    // Assert: require successful creation and concrete response shape
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('order');
    const order = res.body.order;
    expect(order).toHaveProperty('items');
    expect(Array.isArray(order.items)).toBe(true);
    expect(order).toHaveProperty('totalAmount');
    expect(typeof order.totalAmount).toBe('number');
    expect(order).toHaveProperty('status');
    expect(String(order.status).toUpperCase()).toBe('PENDING');
    expect(order).toHaveProperty('shippingAddress');

    // items have productId, quantity, price { amount, currency }
    if (order.items.length > 0) {
      const item = order.items[0];
      expect(item).toHaveProperty('productId');
      expect(item).toHaveProperty('quantity');
      expect(typeof item.quantity).toBe('number');
      expect(item).toHaveProperty('price');
      expect(item.price).toHaveProperty('amount');
      expect(typeof item.price.amount).toBe('number');
      expect(item.price).toHaveProperty('currency');
      expect(typeof item.price.currency).toBe('string');
    }

    // Optional: verify computed total
    expect(order.totalAmount).toBe(2 * 10 + 1 * 20);
  });


});
