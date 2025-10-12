const request = require('supertest');
const mongoose = require('mongoose');
const { app, setupTestDB, teardownTestDB } = require('../utils/testServer');

describe('DELETE /api/cart/items/:productId - Remove line item', () => {
  const AUTH_COOKIE = 'token=test.jwt.token';
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test('removes existing line item; returns 200', async () => {
    const productId = new mongoose.Types.ObjectId().toHexString();
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', AUTH_COOKIE)
      .send({ productId, qty: 1 });
    const res = await request(app)
      .delete(`/api/cart/items/${productId}`)
      .set('Cookie', AUTH_COOKIE)
      .set('Accept', 'application/json');
    expect(res.status).toBe(200);
    const exists = res.body.cart.items.some((i) => i.productId === productId || i.productId?.toString?.() === productId);
    expect(exists).toBe(false);
  });

  test('returns 404 when line item not found', async () => {
    const productId = '000000000000000000000000';
    const res = await request(app)
      .delete(`/api/cart/items/${productId}`)
      .set('Cookie', AUTH_COOKIE)
      .set('Accept', 'application/json');
    expect(res.status).toBe(404);
  });
});
