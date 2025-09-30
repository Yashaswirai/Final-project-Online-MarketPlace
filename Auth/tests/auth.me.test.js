const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const userModel = require('../src/models/user.model');
require('./setup');

// Helper to register a user and return { res, token }
const register = async (overrides = {}) => {
  const payload = {
    username: 'meuser',
    email: 'meuser@example.com',
    password: 'password123',
    fullName: { firstName: 'Me', lastName: 'User' },
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(payload).expect(201);
  return { res, token: res.body.token, userId: res.body.id };
};

/*
Expected future /api/auth/me contract (not yet implemented):
GET /api/auth/me
Headers: Authorization: Bearer <jwt> (or cookie `token`)
Success 200 JSON: { id, username, email, role }
Errors:
  401 if token missing / invalid / expired
  404 if user referenced in token no longer exists
*/

describe('GET /auth/me (spec first)', () => {
  it('should return current user profile with valid Bearer token', async () => {
    const { token } = await register();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: 'meuser',
      email: 'meuser@example.com',
      role: 'user',
    });
    expect(res.body).toHaveProperty('id');
    // Should not expose password
    expect(res.body).not.toHaveProperty('password');
  });

  it('should return 401 if no token provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect([401, 403]).toContain(res.status); // allow either until finalized
  });

  it('should return 401 for invalid token', async () => {
    const invalidToken = 'invalid.token.here';
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect([401, 403]).toContain(res.status);
  });

  it('should return 404 if user no longer exists', async () => {
    const { token, userId } = await register({ username: 'tobedeleted', email: 'tobedeleted@example.com' });

    // Simulate user deletion after token issuance
    await userModel.deleteOne({ _id: userId });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect([404, 401]).toContain(res.status); // Accept 401 if implementation chooses generic response
  });

  it('should return current user profile when token provided only in cookie', async () => {
    const { res: regRes } = await register({ username: 'cookietest', email: 'cookietest@example.com' });
    const cookies = regRes.headers['set-cookie'];
    expect(Array.isArray(cookies)).toBe(true);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(200); // Will fail until implementation added
    expect(res.body).toMatchObject({
      username: 'cookietest',
      email: 'cookietest@example.com',
      role: 'user'
    });
    expect(res.body).toHaveProperty('id');
    expect(res.body).not.toHaveProperty('password');
  });

  it('should return current user profile when token present in both header and cookie', async () => {
    const { token, res: regRes } = await register({ username: 'bothsrc', email: 'bothsrc@example.com' });
    const cookies = regRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200); // Implementation may choose header precedence; test only for success
    expect(res.body).toMatchObject({
      username: 'bothsrc',
      email: 'bothsrc@example.com',
      role: 'user'
    });
    expect(res.body).toHaveProperty('id');
    expect(res.body).not.toHaveProperty('password');
  });
});
