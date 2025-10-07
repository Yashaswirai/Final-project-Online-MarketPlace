const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock ImageKit to avoid requiring real credentials when controller is imported
jest.mock('../src/services/imagekit.service', () => ({
  uploadImage: jest.fn(async () => ({ url: 'http://example.com/img', thumbnailUrl: 'http://example.com/thumb', fileId: 'file_1' })),
}));

const app = require('../src/app');
const Product = require('../src/models/product.model');

let mongoServer;
let existingProduct;

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
  existingProduct = await Product.create({
    title: 'Test Product',
    description: 'A product for get-by-id tests',
    price: { amount: 49.99, currency: 'USD' },
    seller: new mongoose.Types.ObjectId(),
    images: [
      { url: 'http://example.com/1.jpg', thumbnail: 'http://example.com/t1.jpg', id: 'img1' },
    ],
  });
});

describe('GET /api/products/:id - get product by id', () => {
  test('returns 200 and the product when a valid existing id is provided', async () => {
    const res = await request(app).get(`/api/products/${existingProduct._id.toString()}`);
    // Expectation of controller contract: { success: true, data: product }
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data._id).toBe(existingProduct._id.toString());
    expect(res.body.data.title).toBe('Test Product');
    expect(res.body.data.price).toMatchObject({ amount: 49.99, currency: 'USD' });
  });

  test('returns 404 when product does not exist', async () => {
    const missingId = new mongoose.Types.ObjectId().toHexString();
    const res = await request(app).get(`/api/products/${missingId}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('returns 400 for invalid id format', async () => {
    const res = await request(app).get('/api/products/not-a-valid-id');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid.*id/i);
  });
});
