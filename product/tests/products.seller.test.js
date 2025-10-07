const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock ImageKit to avoid credentials/network on import
jest.mock('../src/services/imagekit.service', () => ({
  uploadImage: jest.fn(async () => ({ url: 'http://example.com/img', thumbnailUrl: 'http://example.com/thumb', fileId: 'file_1' })),
}));

const app = require('../src/app');
const Product = require('../src/models/product.model');

const TEST_SECRET = process.env.JWT_SECRET || 'testsecret';
function makeSellerToken(id = new mongoose.Types.ObjectId().toHexString()) {
  return { id, token: jwt.sign({ id, role: 'seller' }, TEST_SECRET) };
}
function makeUserToken(id = new mongoose.Types.ObjectId().toHexString()) {
  return { id, token: jwt.sign({ id, role: 'user' }, TEST_SECRET) };
}

let mongoServer;

describe('GET /api/products/seller (SELLER) - list seller products', () => {
  let sellerA;
  let sellerB;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    sellerA = makeSellerToken();
    sellerB = makeSellerToken();

    // Seed products for two sellers
    await Product.insertMany([
      { title: 'A1', description: 'A1', price: { amount: 5, currency: 'USD' }, seller: new mongoose.Types.ObjectId(sellerA.id) },
      { title: 'A2', description: 'A2', price: { amount: 6, currency: 'USD' }, seller: new mongoose.Types.ObjectId(sellerA.id) },
      { title: 'A3', description: 'A3', price: { amount: 7, currency: 'USD' }, seller: new mongoose.Types.ObjectId(sellerA.id) },
      { title: 'B1', description: 'B1', price: { amount: 8, currency: 'USD' }, seller: new mongoose.Types.ObjectId(sellerB.id) },
      { title: 'B2', description: 'B2', price: { amount: 9, currency: 'USD' }, seller: new mongoose.Types.ObjectId(sellerB.id) },
    ]);
  });

  test('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/products/seller');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no token/i);
  });

  test('returns 403 when role is not seller', async () => {
    const user = makeUserToken();
    const res = await request(app)
      .get('/api/products/seller')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/access denied/i);
  });

  test('returns 200 with only the authenticated seller\'s products', async () => {
    const res = await request(app)
      .get('/api/products/seller')
      .set('Authorization', `Bearer ${sellerA.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(3);
    const sellers = new Set(res.body.data.map((p) => p.seller?.toString?.() || p.seller));
    expect(sellers.size).toBe(1);
    expect([...sellers][0]).toBe(sellerA.id);
  });

  test('returns empty array for seller with no products', async () => {
    const lonelySeller = makeSellerToken();
    const res = await request(app)
      .get('/api/products/seller')
      .set('Authorization', `Bearer ${lonelySeller.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  test('supports pagination with skip and limit', async () => {
    const res = await request(app)
      .get('/api/products/seller')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .query({ skip: 2, limit: 2 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.skip).toBe(2);
    expect(res.body.meta.limit).toBe(2);
  });
});
