const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Stub ImageKit to avoid external dependency during tests (controller may import it)
jest.mock('../src/services/imagekit.service', () => ({
  uploadImage: jest.fn(async () => ({ url: 'http://example.com/img', thumbnailUrl: 'http://example.com/thumb', fileId: 'file_1' })),
}));

const app = require('../src/app');
const Product = require('../src/models/product.model');

// Helpers
const TEST_SECRET = process.env.JWT_SECRET || 'testsecret';
function makeSellerToken(id = new mongoose.Types.ObjectId().toHexString()) {
  return { id, token: jwt.sign({ id, role: 'seller' }, TEST_SECRET) };
}
function makeUserToken(id = new mongoose.Types.ObjectId().toHexString()) {
  return { id, token: jwt.sign({ id, role: 'user' }, TEST_SECRET) };
}

let mongoServer;

describe('PATCH /api/products/:id (SELLER) - update product fields', () => {
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
      title: 'Old Title A',
      description: 'Old description A',
      price: { amount: 10, currency: 'USD' },
      seller: new mongoose.Types.ObjectId(sellerA.id),
      images: [],
    });
    productB = await Product.create({
      title: 'Old Title B',
      description: 'Old description B',
      price: { amount: 20, currency: 'USD' },
      seller: new mongoose.Types.ObjectId(sellerB.id),
      images: [],
    });
  });

  test('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .patch(`/api/products/${productA._id.toString()}`)
      .send({ title: 'New Title' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no token/i);
  });

  test('rejects users without seller role with 403', async () => {
    const user = makeUserToken();
    const res = await request(app)
      .patch(`/api/products/${productA._id.toString()}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'New Title' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/access denied/i);
  });

  test('rejects invalid id format with 400', async () => {
    const res = await request(app)
      .patch('/api/products/not-a-valid-id')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({ title: 'New Title' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid.*id/i);
  });

  test('returns 404 when product not found', async () => {
    const missingId = new mongoose.Types.ObjectId().toHexString();
    const res = await request(app)
      .patch(`/api/products/${missingId}`)
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({ title: 'New Title' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('forbids seller from updating a product they do not own (403)', async () => {
    const res = await request(app)
      .patch(`/api/products/${productB._id.toString()}`)
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({ title: 'Hack Title' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not authorized|access denied/i);
  });

  test('updates allowed fields for owner and returns 200 with updated product', async () => {
    const payload = {
      title: 'Updated Title A',
      description: 'Updated description A',
      priceAmount: 15.5,
      priceCurrency: 'INR',
    };
    const res = await request(app)
      .patch(`/api/products/${productA._id.toString()}`)
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
    expect(res.body.product).toMatchObject({
      _id: productA._id.toString(),
      title: payload.title,
      description: payload.description,
      price: { amount: payload.priceAmount, currency: 'INR' },
    });
  });

  test('partial updates work (only description)', async () => {
    const res = await request(app)
      .patch(`/api/products/${productA._id.toString()}`)
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({ description: 'Partially updated' });

    expect(res.status).toBe(200);
    expect(res.body.product.description).toBe('Partially updated');
    expect(res.body.product.title).toBe(productA.title);
    expect(res.body.product.price.amount).toBe(productA.price.amount);
  });

  test('validates field constraints and returns 400 with errors array', async () => {
    const res = await request(app)
      .patch(`/api/products/${productA._id.toString()}`)
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({
        title: 'ab', // too short
        description: 'abcd', // too short
        priceAmount: -10, // invalid
        priceCurrency: 'EUR', // not allowed
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const fields = res.body.errors.map((e) => e.field).sort();
    expect(fields).toEqual(
      expect.arrayContaining(['title', 'description', 'priceAmount', 'priceCurrency'])
    );
  });
});
