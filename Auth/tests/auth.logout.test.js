const request = require('supertest');
const app = require('../src/app');
require('./setup');

// Helper to register user (returns response with cookie + token)
const register = async (overrides = {}) => {
  const payload = {
    username: 'logoutuser',
    email: 'logoutuser@example.com',
    password: 'password123',
    fullName: { firstName: 'Log', lastName: 'Out' },
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(payload).expect(201);
  return { token: res.body.token, cookies: res.headers['set-cookie'], body: res.body };
};

/*
Specification-first design for GET /api/auth/logout (not implemented yet):

Endpoint: GET /api/auth/logout
Behavior:
  - If a valid auth token cookie exists (e.g., 'token'), clear it (Set-Cookie with expired date / empty value)
  - Should also succeed idempotently if no cookie or invalid token present
  - Should NOT require a body
  - Response 200 (or 204) with JSON { message: 'Logged out' } (we assert 200 for determinism)
  - Must set Set-Cookie header that invalidates token (Expires in past OR Max-Age=0)
Edge Cases:
  - No token cookie supplied -> still 200 with message
  - Token only in Authorization header -> still respond 200 but should not set *new* auth cookie; optionally clear cookie if exists
  - Both header + cookie -> cookie cleared
Security Notes (implied expectations):
  - Should use httpOnly, secure flags when clearing cookie (mirrors issue of setting cookie on login)
*/

describe('GET /auth/logout (spec first)', () => {
  it('should clear auth cookie and return 200 with message', async () => {
    const { cookies } = await register();

    const res = await request(app)
      .get('/api/auth/logout')
      .set('Cookie', cookies);

    expect(res.status).toBe(200); // until implemented will fail
    expect(res.body).toHaveProperty('message');
    expect(res.body.message.toLowerCase()).toMatch(/logged out|logout/);

    const setCookie = res.headers['set-cookie'];
    expect(Array.isArray(setCookie)).toBe(true);
    // Look for token cookie cleared
    const tokenCookie = setCookie.find(c => /^token=/.test(c));
    expect(tokenCookie).toBeDefined();
    // Should either expire immediately or have Max-Age=0
    expect(/Max-Age=0|Expires=/i.test(tokenCookie)).toBe(true);
  });

  it('should be idempotent when no cookie is supplied', async () => {
    const res = await request(app).get('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message.toLowerCase()).toMatch(/logged out|logout/);
  });

  it('should clear cookie even if Authorization header also present', async () => {
    const { token, cookies } = await register({ username: 'logoutboth', email: 'logoutboth@example.com' });

    const res = await request(app)
      .get('/api/auth/logout')
      .set('Cookie', cookies)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    const tokenCookie = setCookie && setCookie.find(c => /^token=/.test(c));
    expect(tokenCookie).toBeDefined();
    expect(/Max-Age=0|Expires=/i.test(tokenCookie)).toBe(true);
  });

  it('should still respond 200 when only Authorization header is present (no cookie to clear)', async () => {
    const { token } = await register({ username: 'logoutheaderonly', email: 'logoutheaderonly@example.com' });

    const res = await request(app)
      .get('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Optionally may not send Set-Cookie if nothing to clear; allow either
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const tokenCookie = setCookie.find(c => /^token=/.test(c));
      if (tokenCookie) {
        expect(/Max-Age=0|Expires=/i.test(tokenCookie)).toBe(true);
      }
    }
  });

  it('should not expose sensitive fields in logout response', async () => {
    const { cookies } = await register({ username: 'logoutprivacy', email: 'logoutprivacy@example.com' });

    const res = await request(app)
      .get('/api/auth/logout')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    // Ensure only message field (or minimal fields) returned
    expect(res.body).not.toHaveProperty('token');
    expect(res.body).not.toHaveProperty('password');
  });
});
