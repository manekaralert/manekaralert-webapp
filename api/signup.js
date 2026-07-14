// api/signup.js
// POST /api/signup
// Body: { email, password }
// Creates a new investor account in the MongoDB "users" collection.
// Passwords are hashed with bcrypt before storage — never stored in plain text.

const bcrypt = require("bcryptjs");
const { getDb } = require("./_db");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const db = await getDb();
    const users = db.collection("users");

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await users.insertOne({
      email: normalizedEmail,
      passwordHash,
      tier: "free", // "free" | "premium" — used later for report/vault gating
      createdAt: new Date(),
    });

    return res.status(201).json({
      message: "Account created successfully.",
      userId: result.insertedId,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
      
