const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock ImageKit service to prevent requiring real credentials
jest.mock('../src/services/imagekit.service', () => ({
  uploadImage: jest.fn(async () => ({ url: 'http://example.com/img', thumbnailUrl: 'http://example.com/thumb', fileId: 'file_1' })),
}));

const app = require('../src/app');
const Product = require('../src/models/product.model');

let mongoServer;

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
  await Product.insertMany([
    { title: 'A', description: 'A desc', price: { amount: 5, currency: 'USD' }, seller: new mongoose.Types.ObjectId() },
    { title: 'B', description: 'B desc', price: { amount: 10, currency: 'USD' }, seller: new mongoose.Types.ObjectId() },
    { title: 'C', description: 'C desc', price: { amount: 15, currency: 'USD' }, seller: new mongoose.Types.ObjectId() },
    { title: 'D', description: 'D desc', price: { amount: 20, currency: 'USD' }, seller: new mongoose.Types.ObjectId() },
  ]);
});

describe('GET /api/products - listing with query params', () => {
  test('returns 200 and default pagination when no params provided', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.meta.skip).toBe(0);
    expect(res.body.meta.limit).toBe(10);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('applies skip and limit', async () => {
    const res = await request(app).get('/api/products').query({ skip: 1, limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.meta.skip).toBe(1);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.data.length).toBe(2);
  });

  test('clamps invalid skip/limit values', async () => {
    const res = await request(app).get('/api/products').query({ skip: -5, limit: 0 });
    expect(res.status).toBe(200);
    expect(res.body.meta.skip).toBe(0);
    expect(res.body.meta.limit).toBe(10); // default
  });

  test('filters by minPrice and maxPrice', async () => {
    const res = await request(app).get('/api/products').query({ minPrice: 10, maxPrice: 15 });
    expect(res.status).toBe(200);
    const amounts = res.body.data.map((p) => p.price.amount).sort((a,b)=>a-b);
    expect(amounts).toEqual([10, 15]);
    expect(res.body.meta.filters).toMatchObject({ minPrice: 10, maxPrice: 15 });
  });

  test('handles only minPrice', async () => {
    const res = await request(app).get('/api/products').query({ minPrice: 16 });
    expect(res.status).toBe(200);
    // Expect items with amount >= 16 => 20 only
    expect(res.body.data.map((p) => p.price.amount)).toEqual([20]);
  });

  test('handles only maxPrice', async () => {
    const res = await request(app).get('/api/products').query({ maxPrice: 9 });
    expect(res.status).toBe(200);
    // Expect items with amount <= 9 => 5 only
    expect(res.body.data.map((p) => p.price.amount)).toEqual([5]);
  });

  test('rejects non-numeric price filters', async () => {
    const res = await request(app).get('/api/products').query({ minPrice: 'abc', maxPrice: 'xyz' });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field).sort();
    expect(fields).toEqual(['maxPrice', 'minPrice']);
  });

  test('caps limit to 50', async () => {
    const res = await request(app).get('/api/products').query({ limit: 500 });
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);
  });
});
