// api/_auth.js
// Shared helper to verify the JWT token sent from the frontend
// (as an "Authorization: Bearer <token>" header).
// Use this inside any future route that should be login-only or
// premium-only, e.g. api/reports.js.
//
// SECURITY: algorithms: ["HS256"] is explicitly whitelisted below.
// This blocks the "alg: none" forgery attack (where a forged token
// header claims no signature is needed) and algorithm-confusion
// attacks — jwt.verify() will REJECT any token that doesn't use
// exactly HS256, no matter what its header claims. This matches how
// login.js signs tokens (also HS256), so nothing else changes.

const jwt = require("jsonwebtoken");

function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    return null; // expired, invalid, or wrong-algorithm token — all rejected
  }
}

module.exports = { getUserFromRequest };
