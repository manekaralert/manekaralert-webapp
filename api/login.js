// api/login.js
// POST /api/login
// Body: { email, password }
// Verifies the user against the MongoDB "users" collection and returns
// a signed JWT token on success. This is the endpoint index.html's
// executeSecureLogin() function calls.

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("./_db");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!JWT_SECRET) {
    console.error("JWT_SECRET is not set in environment variables.");
    return res.status(500).json({ error: "Server misconfigured. Please contact support." });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const db = await getDb();
    const users = db.collection("users");

    const normalizedEmail = email.trim().toLowerCase();
    const user = await users.findOne({ email: normalizedEmail });

    // Same generic error for "no user" and "wrong password" —
    // avoids leaking which emails are registered.
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, tier: user.tier || "free" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      token,
      email: user.email,
      tier: user.tier || "free",
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
