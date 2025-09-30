const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
require("./setup");

// No need to connect/disconnect mongoose here.

// We connect manually via setup.js using mongodb-memory-server.

describe("POST /auth/register", () => {
  it("should create a new user and return 201 with public fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "john",
        email: "john@example.com",
        password: "secret",
        fullName: { firstName: "John", lastName: "Doe" },
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.username).toBe("john");
    expect(res.body.email).toBe("john@example.com");
    expect(res.body).toHaveProperty("token");
    // expect(res.body.fullName).toEqual({ firstName: "John", lastName: "Doe" });
    // Ensure password not returned
    expect(res.body).not.toHaveProperty("password");
  });

  it("should not allow duplicate username/email with 409", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        username: "dup",
        email: "dup@example.com",
        password: "secret",
        fullName: { firstName: "Dup", lastName: "User" },
      })
      .expect(201);

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "dup",
        email: "dup@example.com",
        password: "secret2",
        fullName: { firstName: "Dup", lastName: "User" },
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("should validate required fields with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "", email: "", password: "" });

    expect(res.status).toBe(400);
  });

  it("should validate email format with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "invalidemail",
        email: "notanemail", // invalid format
        password: "short", // too short (<6)
        fullName: { firstName: "I", lastName: "V" }, // too short (<2)
      });
    expect(res.status).toBe(400);
    const hasErr = (field) =>
      res.body.errors.some(
        (e) => e.param === field || e.path === field
      );
    expect(hasErr("email")).toBe(true);
    expect(hasErr("password")).toBe(true);
    expect(hasErr("fullName.firstName")).toBe(true);
    expect(hasErr("fullName.lastName")).toBe(true);
  });
});
