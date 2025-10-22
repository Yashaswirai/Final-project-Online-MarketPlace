const jwt = require("jsonwebtoken");

function makeAuthToken(
  payload = { _id: "507f191e810c19729de860ea", role: "user" },
  secret = process.env.JWT_SECRET || "testsecret"
) {
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

module.exports = {
  makeAuthToken,
};
