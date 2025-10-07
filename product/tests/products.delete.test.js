const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock ImageKit to avoid credential requirements when app loads controllers
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

describe('DELETE /api/products/:id (SELLER) - delete product', () => {
  let sellerA;
  let sellerB;
  let productA;
  let productB;

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

    productA = await Product.create({
      title: 'Product A',
      description: 'Desc A',
      price: { amount: 10, currency: 'USD' },
      seller: new mongoose.Types.ObjectId(sellerA.id),
      images: [],
    });

    productB = await Product.create({
      title: 'Product B',
      description: 'Desc B',
      price: { amount: 20, currency: 'USD' },
      seller: new mongoose.Types.ObjectId(sellerB.id),
      images: [],
    });
  });

  test('returns 401 when unauthenticated', async () => {
    const res = await request(app).delete(`/api/products/${productA._id.toString()}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no token/i);
  });

  test('returns 403 when role is not seller', async () => {
    const user = makeUserToken();
    const res = await request(app)
      .delete(`/api/products/${productA._id.toString()}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/access denied/i);
  });

  test('returns 400 for invalid id format', async () => {
    const res = await request(app)
      .delete('/api/products/not-a-valid-id')
      .set('Authorization', `Bearer ${sellerA.token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid.*id/i);
  });

  test('returns 404 when product does not exist', async () => {
    const missingId = new mongoose.Types.ObjectId().toHexString();
    const res = await request(app)
      .delete(`/api/products/${missingId}`)
      .set('Authorization', `Bearer ${sellerA.token}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('returns 403 when seller tries to delete product they do not own', async () => {
    const res = await request(app)
      .delete(`/api/products/${productB._id.toString()}`)
      .set('Authorization', `Bearer ${sellerA.token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not authorized|access denied/i);
  });

  test('deletes own product and returns 200', async () => {
    const res = await request(app)
      .delete(`/api/products/${productA._id.toString()}`)
      .set('Authorization', `Bearer ${sellerA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);

    // Verify it is gone
    const check = await Product.findById(productA._id);
    expect(check).toBeNull();
  });

  test('idempotent delete: second delete returns 404', async () => {
    await Product.deleteOne({ _id: productA._id });
    const res = await request(app)
      .delete(`/api/products/${productA._id.toString()}`)
      .set('Authorization', `Bearer ${sellerA.token}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
