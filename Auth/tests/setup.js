const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  // Ensure test environment flag so redis mock is used
  process.env.NODE_ENV = 'test';
  // Ensure JWT secret exists for token generation in tests
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri; // So the app's connect function could use it if needed
  await mongoose.connect(uri);
});

beforeEach(async () => {
  // Clean all collections between tests
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
