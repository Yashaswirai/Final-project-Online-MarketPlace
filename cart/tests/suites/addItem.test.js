const request = require("supertest");
const mongoose = require("mongoose");
const { app, setupTestDB, teardownTestDB } = require("../utils/testServer");

describe("POST /api/cart/items - Add item to cart", () => {
  const AUTH_COOKIE = "token=test.jwt.token"; // dummy token accepted in tests
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("adds item when payload is valid; returns 200 and includes cart with item", async () => {
    const productId = new mongoose.Types.ObjectId().toHexString();
    const payload = { productId, qty: 2 };
    const res = await request(app)
      .post("/api/cart/items")
      .set("Cookie", AUTH_COOKIE)
      .set("Accept", "application/json")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("cart");
    expect(Array.isArray(res.body.cart.items)).toBe(true);
    const item = res.body.cart.items.find((i) => i.productId === productId || i.productId?.toString?.() === productId);
    expect(item).toBeTruthy();
    expect(item.quantity).toBe(2);
  });

  test("returns 400 for invalid payload (missing productId or qty <= 0)", async () => {
    const res = await request(app)
      .post("/api/cart/items")
      .set("Cookie", AUTH_COOKIE)
      .send({ qty: 0 });
    expect([400]).toContain(res.status);
  });

  test("adds same product twice accumulates quantity", async () => {
    const productId = new mongoose.Types.ObjectId().toHexString();
    await request(app)
      .post("/api/cart/items")
      .set("Cookie", AUTH_COOKIE)
      .send({ productId, qty: 1 });
    const res = await request(app)
      .post("/api/cart/items")
      .set("Cookie", AUTH_COOKIE)
      .send({ productId, qty: 3 });
    expect(res.status).toBe(200);
    const item = res.body.cart.items.find((i) => i.productId === productId || i.productId?.toString?.() === productId);
    expect(item.quantity).toBe(4);
  });
});
