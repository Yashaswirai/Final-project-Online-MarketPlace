const request = require("supertest");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");

// Mock only the external ImageKit service to avoid network calls
jest.mock("../src/services/imagekit.service", () => ({
  uploadImage: jest.fn(async ({ file, filename }) => ({
    url: `https://example.com/${filename || 'image'}`,
    thumbnailUrl: `https://example.com/thumbs/${filename || 'image'}`,
    fileId: `file_${Math.random().toString(16).slice(2)}`,
  })),
}));

// Ensure JWT secret is set before generating tokens
const TEST_SECRET = process.env.JWT_SECRET || "testsecret";
process.env.JWT_SECRET = TEST_SECRET;

// Generate auth tokens
function makeId() {
  // Use a valid MongoDB ObjectId hex string (24 chars)
  return new mongoose.Types.ObjectId().toHexString();
}
function makeToken(role = "seller", id = makeId()) {
  return jwt.sign({ id, role }, TEST_SECRET);
}

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

describe("POST /api/products - create product", () => {
  test("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/products").send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  test("rejects users without required role", async () => {
    const token = makeToken("user");
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Access Denied/i);
  });

  test("validates required fields", async () => {
    const token = makeToken("seller");
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "") // invalid
      .field("description", "abc") // too short
      .field("priceAmount", "-5") // invalid
      .field("priceCurrency", "EUR"); // invalid

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const fields = res.body.errors.map((e) => e.field).sort();
    expect(fields).toEqual(
      expect.arrayContaining([
        "title",
        "description",
        "priceCurrency",
        "priceAmount",
      ])
    );
  });

  test("creates product with valid payload for seller", async () => {
    const token = makeToken("seller");

    const payload = {
      title: "Awesome Gadget",
      description: "A really awesome gadget that does many things.",
      priceAmount: "19.99",
      priceCurrency: "USD",
    };

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Product created successfully/i);
    expect(res.body.product).toMatchObject({
      title: payload.title,
      description: payload.description,
      price: {
        amount: parseFloat(payload.priceAmount),
        currency: payload.priceCurrency,
      },
    });
  });

  test("allows admin role as well", async () => {
    const token = makeToken("admin");

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Admin Product",
        description: "Created by admin",
        priceAmount: "99.99",
        priceCurrency: "USD",
      });

    expect(res.status).toBe(201);
  });

  test("normalizes currency to uppercase and coerces amount to number", async () => {
    const token = makeToken("seller");

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Case Test",
        description: "Checking currency normalization and amount coercion.",
        priceAmount: "42.50",
        priceCurrency: "usd",
      });
    expect(res.status).toBe(201);
    expect(res.body.product.price.currency).toBe("USD");
    expect(res.body.product.price.amount).toBeCloseTo(42.5);
    expect(typeof res.body.product.price.amount).toBe("number");
  });

  test("accepts auth via cookie header", async () => {
    const token = makeToken("seller");

    const res = await request(app)
      .post("/api/products")
      .set("Cookie", [`token=${token}`])
      .send({
        title: "Cookie Auth Product",
        description: "Created using cookie token",
        priceAmount: 12,
        priceCurrency: "INR",
      });

    expect(res.status).toBe(201);
    expect(res.body.product).toBeDefined();
  });

  test("rejects invalid JWT token", async () => {
    const badToken = "bad.token.value";
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${badToken}`)
      .send({
        title: "X",
        description: "Y",
        price: { amount: 1, currency: "USD" },
      });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid token/i);
  });

  test("rejects when price fields are missing", async () => {
    const token = makeToken("seller");
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Invalid Price",
        description: "Price should be an object",
        // Missing priceAmount and priceCurrency
      });

    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(["priceAmount", "priceCurrency"])
    );
  });

  test("enforces title and description length boundaries", async () => {
    const token = makeToken("seller");

    // Too short title and description
    let res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "ab",
        description: "abcd",
        priceAmount: 5,
        priceCurrency: "USD",
      });
    expect(res.status).toBe(400);
    let fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["title", "description"]));

    // Excessively long title
    const longTitle = "a".repeat(121);
    res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: longTitle,
        description: "valid description here",
        priceAmount: 5,
        priceCurrency: "USD",
      });
    expect(res.status).toBe(400);
    fields = res.body.errors.map((e) => e.field);
    expect(fields).toContain("title");

    // Boundary valid values: title length 3, description length 5
    res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "abc",
        description: "abcde",
        priceAmount: 5,
        priceCurrency: "USD",
      });
    expect(res.status).toBe(201);
  });

  test("supports multipart form with up to 5 images", async () => {
    const token = makeToken("seller");

    const reqBuilder = request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Multipart Product")
      .field("description", "Has some images attached")
      .field("priceAmount", "19.99")
      .field("priceCurrency", "USD");

    // Attach 5 tiny buffers as images
    for (let i = 0; i < 5; i++) {
      reqBuilder.attach(
        "images",
        Buffer.from([0x47, 0x49, 0x46]),
        `img${i}.gif`
      );
    }

    const res = await reqBuilder;
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.product.images)).toBe(true);
    expect(res.body.product.images.length).toBe(5);
  });

  test("rejects more than 5 images in multipart upload", async () => {
    const token = makeToken("seller");

    const reqBuilder = request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Too Many Images")
      .field("description", "Attempt to upload 6 images")
      .field("priceAmount", "29.99")
      .field("priceCurrency", "USD");

    for (let i = 0; i < 6; i++) {
      reqBuilder.attach(
        "images",
        Buffer.from([0x47, 0x49, 0x46]),
        `img${i}.gif`
      );
    }

    const res = await reqBuilder;
    // Multer should error when exceeding maxCount; we expect a client/server error, not success.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
