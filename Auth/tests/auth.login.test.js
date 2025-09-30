const request = require('supertest');
const app = require('../src/app');
require('./setup');

// Helper to register a user first
const register = async (overrides = {}) => {
  const payload = {
    username: 'loginuser',
    email: 'login@example.com',
    password: 'password123',
    fullName: { firstName: 'Login', lastName: 'User' },
    ...overrides,
  };
  return request(app).post('/api/auth/register').send(payload).expect(201);
};

describe('POST /auth/login', () => {
  it('should login with username and return token', async () => {
    await register();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'loginuser', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toBe('loginuser');
    expect(res.body.email).toBe('login@example.com');
  });

  it('should login with email and return token', async () => {
    await register({ username: 'byemail', email: 'byemail@example.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'byemail@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toBe('byemail');
  });

  it('should return 401 for invalid password', async () => {
    await register({ username: 'wrongpass', email: 'wrongpass@example.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'wrongpass', password: 'badpassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('should return 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'idontexist', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('should validate missing fields with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '', password: '' });

    expect(res.status).toBe(400);
  });
});
