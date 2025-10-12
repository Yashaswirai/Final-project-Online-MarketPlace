const request = require('supertest');
const mongoose = require('mongoose');
const { app, setupTestDB, teardownTestDB } = require('../utils/testServer');

describe('PATCH /api/cart/items/:productId - Update quantity or remove', () => {
  const AUTH_COOKIE = 'token=test.jwt.token';
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test('updates quantity when qty > 0; returns 200 and updated cart', async () => {
    const productId = new mongoose.Types.ObjectId().toHexString();
    // seed the item first via add
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', AUTH_COOKIE)
      .send({ productId, qty: 1 });
    const res = await request(app)
      .patch(`/api/cart/items/${productId}`)
      .set('Cookie', AUTH_COOKIE)
      .set('Accept', 'application/json')
      .send({ qty: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cart');
    const item = res.body.cart.items.find((i) => i.productId === productId || i.productId?.toString?.() === productId);
    expect(item).toBeTruthy();
    expect(item.quantity).toBe(3);
  });

  test('removes line when qty <= 0; returns 200 and item disappears', async () => {
    const productId = new mongoose.Types.ObjectId().toHexString();
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', AUTH_COOKIE)
      .send({ productId, qty: 2 });
    const res = await request(app)
      .patch(`/api/cart/items/${productId}`)
      .set('Cookie', AUTH_COOKIE)
      .set('Accept', 'application/json')
      .send({ qty: 0 });
    expect(res.status).toBe(200);
    const exists = res.body.cart.items.some((i) => i.productId === productId || i.productId?.toString?.() === productId);
    expect(exists).toBe(false);
  });

  test('returns 404 when product is not in the cart', async () => {
    const productId = '000000000000000000000000';
    const res = await request(app)
      .patch(`/api/cart/items/${productId}`)
      .set('Cookie', AUTH_COOKIE)
      .set('Accept', 'application/json')
      .send({ qty: 2 });
    expect(res.status).toBe(404);
  });
});
