// Jest setup: configure .env, in-memory MongoDB, and Mongoose connection isolation
require('dotenv').config({ path: '.env.test' });

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Ensure app code uses this URI
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

  // Connect mongoose (some app code might require a connection explicitly)
  await mongoose.connect(uri, {
    dbName: 'jest-order-tests',
  });
});

beforeEach(async () => {
  // Cleanup all collections between tests
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  // Close mongoose and stop in-memory server
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
});
