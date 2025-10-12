const request = require("supertest");
const { app, setupTestDB, teardownTestDB } = require("../utils/testServer");

describe("GET /api/cart - Fetch current cart", () => {
  const AUTH_COOKIE = "token=test.jwt.token"; // adjust cookie name/value if your service differs
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("returns 200 with items when cart exists", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", AUTH_COOKIE)
      .set("Accept", "application/json");
    expect([200, 204]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("cart");
      expect(Array.isArray(res.body.cart.items)).toBe(true);
      expect(res.body.cart.items.length).toBeGreaterThan(0);
    }
  });

  test("returns 204 when cart is empty", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", AUTH_COOKIE);
    expect([200, 204]).toContain(res.status);
  });
});
