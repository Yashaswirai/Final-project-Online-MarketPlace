const request = require('supertest');
const { app, setupTestDB, teardownTestDB } = require('../utils/testServer');

describe('DELETE /api/cart - Clear cart', () => {
  const AUTH_COOKIE = 'token=test.jwt.token';
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test('clears existing cart; returns 200', async () => {
    // seed
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', AUTH_COOKIE)
      .send({ productId: new (require('mongoose').Types.ObjectId)().toHexString(), qty: 1 });
    const res = await request(app)
      .delete('/api/cart')
      .set('Cookie', AUTH_COOKIE)
      .set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cart');
    expect(Array.isArray(res.body.cart.items)).toBe(true);
    expect(res.body.cart.items.length).toBe(0);
  });

  test('idempotent clear: clearing empty cart returns 204', async () => {
    const res = await request(app)
      .delete('/api/cart')
      .set('Cookie', AUTH_COOKIE)
      .set('Accept', 'application/json');
    expect(res.status).toBe(204);
  });
});
