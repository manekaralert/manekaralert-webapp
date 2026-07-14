// api/_auth.js
// Shared helper to verify the JWT token sent from the frontend
// (as an "Authorization: Bearer <token>" header).
// Use this inside any future route that should be login-only or
// premium-only, e.g. api/reports.js.

const jwt = require("jsonwebtoken");

function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null; // expired or invalid token
  }
}

module.exports = { getUserFromRequest };

