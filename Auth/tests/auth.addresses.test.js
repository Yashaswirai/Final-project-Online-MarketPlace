const request = require("supertest");
const app = require("../src/app");
require("./setup");

/*
Specification-first tests for user address management endpoints.

Base path: /api/auth/users/me/addresses
Assumptions / Contract (to be implemented):

1. Authentication required (JWT via Authorization: Bearer <token> OR cookie `token`).
2. POST /api/auth/users/me/addresses
   - Body (JSON): {
       street, city, state, country, pincode, phone, isDefault? (boolean)
     }
   - Validations:
       * pincode: exactly 6 digits (India style) OR 5 digits (US) -> Here we enforce 6 digits numeric for simplicity.
       * phone: 10 digit numeric string.
       * Required: street, city, state, country, pincode, phone
   - Behavior:
       * First address added for a user automatically becomes default (isDefault true) regardless of provided isDefault flag.
       * If isDefault true provided on subsequent address creation, previous default address must be unset and new one becomes default.
       * Returns 201 JSON: created address object including _id and isDefault.

3. GET /api/auth/users/me/addresses
   - Returns 200 JSON: { addresses: [ { _id, street, ..., isDefault } ] }
   - Exactly one address must have isDefault true (if at least one address exists).

4. DELETE /api/auth/users/me/addresses/:addressId
   - Removes the address if it belongs to the authenticated user.
   - Returns 200 JSON: { message: 'Address deleted' } (or similar)
   - If deleted address was default and other addresses remain, one of the remaining addresses becomes the new default (implementation choice: earliest or first in list). Test asserts there is still exactly one default.
   - 404 if address not found for the user.

Edge Cases / Errors:
  - 401 if unauthenticated on any endpoint.
  - 400 on validation errors listing which field(s) failed (structure can mirror existing express-validator style: { errors: [ { param|path, msg } ] }).
*/

// Helper function to register a new user and return authentication token, cookies, and userId
// Accepts optional overrides for user fields
const register = async (overrides = {}) => {
  const payload = {
    username: "addruser" + Math.random().toString(36).slice(2, 6),
    email:
      "addr" +
      Date.now() +
      Math.random().toString(36).slice(2, 4) +
      "@example.com",
    password: "password123",
    fullName: { firstName: "Addr", lastName: "User" },
    ...overrides,
  };
  const res = await request(app)
    .post("/api/auth/register")
    .send(payload)
    .expect(201);
  return {
    token: res.body.token,
    cookies: res.headers["set-cookie"],
    userId: res.body.id,
  };
};

// Utility function to add an address for the authenticated user
// Returns the response object. Checks for expected status (default 201)
const addAddress = async ({ token, cookies }, body, expectedStatus = 201) => {
  const req = request(app)
    .post("/api/auth/users/me/addresses")
    .set("Authorization", `Bearer ${token}`)
    .set("Cookie", cookies)
    .send(body);
  const res = await req;
  expect(res.status).toBe(expectedStatus);
  return res;
};

// Main test suite for User Addresses API
describe("User Addresses API (spec-first)", () => {
  // Tests for authentication requirements on address endpoints
  describe("Authentication guards", () => {
  // Should not allow listing addresses without authentication
  it("should return 401 when listing addresses without auth", async () => {
      const res = await request(app).get("/api/auth/users/me/addresses");
      expect([401, 403]).toContain(res.status);
    });

  // Should not allow adding address without authentication
  it("should return 401 when adding address without auth", async () => {
      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .send({
          street: "1 Main",
          city: "City",
          state: "State",
          country: "Country",
          pincode: "123456",
          phone: "9876543210",
        });
      expect([401, 403]).toContain(res.status);
    });
  });

  // Tests for creating addresses (POST)
  describe("POST /users/me/addresses", () => {
  // First address for a user should always be set as default, even if isDefault is false
  it("should create first address as default regardless of isDefault flag", async () => {
      const auth = await register();
      const res = await addAddress(auth, {
        street: "123 Alpha St",
        city: "Metropolis",
        state: "StateX",
        country: "CountryY",
        pincode: "560001",
        phone: "9998887776",
        isDefault: false, // Should be ignored for first address
      });

      expect(res.body).toHaveProperty("_id");
      expect(res.body.isDefault).toBe(true); // first always default
    });

  // Should allow adding a second address that is not default
  it("should allow adding a second non-default address", async () => {
      const auth = await register();
      await addAddress(auth, {
        street: "Addr1",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560001",
        phone: "9998887776",
      });
      const res = await addAddress(auth, {
        street: "Addr2",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560002",
        phone: "9998887777",
        isDefault: false,
      });
      expect(res.body.isDefault).toBe(false);
    });

  // When a new address is added with isDefault true, it should become the default and previous default should be unset
  it("should reassign default when a new address is added with isDefault true", async () => {
      const auth = await register();
      const first = await addAddress(auth, {
        street: "Primary",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560001",
        phone: "9998887776",
      });
      expect(first.body.isDefault).toBe(true);
      const second = await addAddress(auth, {
        street: "Secondary",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560002",
        phone: "9998887777",
        isDefault: true,
      });
      expect(second.body.isDefault).toBe(true);
      // Ideally the API could return previous default now false if listing
      const list = await request(app)
        .get("/api/auth/users/me/addresses")
        .set("Authorization", `Bearer ${auth.token}`)
        .set("Cookie", auth.cookies);
      if (list.status === 200) {
        const defaults = (list.body.addresses || []).filter((a) => a.isDefault);
        expect(defaults.length).toBe(1);
        expect(defaults[0]._id).toBe(second.body._id);
      }
    });

  // Should validate pincode (must be 6 digits) and return 400 on invalid input
  it("should validate pincode (must be 6 digits) and return 400 on invalid", async () => {
      const auth = await register();
      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Authorization", `Bearer ${auth.token}`)
        .set("Cookie", auth.cookies)
        .send({
          street: "Invalid Pin",
          city: "City",
          state: "State",
          country: "Country",
          pincode: "1234",
          phone: "9998887776",
        });
      expect(res.status).toBe(400);
      // Check validation error structure similar to existing tests (errors array)
      if (res.body.errors) {
        const hasPinErr = res.body.errors.some(
          (e) => e.param === "pincode" || e.path === "pincode"
        );
        expect(hasPinErr).toBe(true);
      }
    });

  // Should validate phone (must be 10 digits) and return 400 on invalid input
  it("should validate phone (must be 10 digits) and return 400 on invalid", async () => {
      const auth = await register();
      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Authorization", `Bearer ${auth.token}`)
        .set("Cookie", auth.cookies)
        .send({
          street: "Invalid Phone",
          city: "City",
          state: "State",
          country: "Country",
          pincode: "560001",
          phone: "12345",
        });
      expect(res.status).toBe(400);
      if (res.body.errors) {
        const hasPhoneErr = res.body.errors.some(
          (e) => e.param === "phone" || e.path === "phone"
        );
        expect(hasPhoneErr).toBe(true);
      }
    });
  });

  // Tests for listing addresses (GET)
  describe("GET /users/me/addresses", () => {
  // Should list all addresses and ensure exactly one is marked as default
  it("should list addresses with exactly one default", async () => {
      const auth = await register();
      await addAddress(auth, {
        street: "A1",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560001",
        phone: "9998887776",
      });
      await addAddress(auth, {
        street: "A2",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560002",
        phone: "9998887777",
        isDefault: true,
      });

      const res = await request(app)
        .get("/api/auth/users/me/addresses")
        .set("Authorization", `Bearer ${auth.token}`)
        .set("Cookie", auth.cookies);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("addresses");
      expect(Array.isArray(res.body.addresses)).toBe(true); // array of addresses returned 
      expect(res.body.addresses.length).toBe(2); // exactly 2 addresses
      const defaults = res.body.addresses.filter((a) => a.isDefault); 
      expect(defaults.length).toBe(1);
    });
  });

  // Tests for deleting addresses (DELETE)
  describe("DELETE /users/me/addresses/:id", () => {
  // Should delete an address and reassign default if the deleted address was default
  it("should delete an address and reassign default if needed", async () => {
      const auth = await register();
      const a1 = await addAddress(auth, {
        street: "Del1",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560001",
        phone: "9998887776",
      });
      const a2 = await addAddress(auth, {
        street: "Del2",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560002",
        phone: "9998887777",
        isDefault: true,
      });

      // Delete the current default (a2)
      const delRes = await request(app)
        .delete(`/api/auth/users/me/addresses/${a2.body._id}`)
        .set("Authorization", `Bearer ${auth.token}`)
        .set("Cookie", auth.cookies);
      expect([200, 204]).toContain(delRes.status);

      const list = await request(app)
        .get("/api/auth/users/me/addresses")
        .set("Authorization", `Bearer ${auth.token}`)
        .set("Cookie", auth.cookies);
      if (list.status === 200) {
        const defaults = (list.body.addresses || []).filter((a) => a.isDefault);
        expect(defaults.length).toBe(1);
        expect(defaults[0]._id).not.toBe(a2.body._id);
      }
    });

  // Should return 404 (or 400) when trying to delete a non-existent address
  it("should return 404 when deleting non-existent address", async () => {
      const auth = await register();
      await addAddress(auth, {
        street: "OnlyOne",
        city: "City",
        state: "State",
        country: "Country",
        pincode: "560001",
        phone: "9998887776",
      });
      const fakeId = "507f1f77bcf86cd799439011"; // valid ObjectId format but not in collection
      const res = await request(app)
        .delete(`/api/auth/users/me/addresses/${fakeId}`)
        .set("Authorization", `Bearer ${auth.token}`)
        .set("Cookie", auth.cookies);
      expect([404, 400]).toContain(res.status); // allow 400 if implementation chooses validation error
    });
  });
});
