// api/login.js
// POST /api/login
// Body: { email, password }
// Verifies the user against the MongoDB "users" collection and returns
// a signed JWT token on success. This is the endpoint index.html's
// executeSecureLogin() function calls.
//
// SECURITY: Includes brute-force protection — after 5 failed attempts
// for the same email, further attempts are blocked for 15 minutes.
// This is tracked in MongoDB (collection "loginAttempts"), which works
// correctly across Vercel's serverless functions (in-memory counters
// would NOT work here, since each function call can run on a different
// server instance).

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("./_db");

const JWT_SECRET = process.env.JWT_SECRET;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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

    const normalizedEmail = email.trim().toLowerCase();

    const db = await getDb();
    const users = db.collection("users");
    const attempts = db.collection("loginAttempts");

    // ---- Brute-force check: is this email currently locked out? ----
    const record = await attempts.findOne({ email: normalizedEmail });
    if (record && record.count >= MAX_ATTEMPTS) {
      const minutesSinceLastFail = (Date.now() - record.lastAttempt.getTime()) / 60000;
      if (minutesSinceLastFail < LOCKOUT_MINUTES) {
        const waitMinutes = Math.ceil(LOCKOUT_MINUTES - minutesSinceLastFail);
        return res.status(429).json({
          error: `Too many failed attempts. Please try again in ${waitMinutes} minute(s).`,
        });
      }
      // Lockout window passed — reset the counter
      await attempts.deleteOne({ email: normalizedEmail });
    }

    const user = await users.findOne({ email: normalizedEmail });

    async function recordFailedAttempt() {
      await attempts.updateOne(
        { email: normalizedEmail },
        { $inc: { count: 1 }, $set: { lastAttempt: new Date() } },
        { upsert: true }
      );
    }

    // Same generic error for "no user" and "wrong password" —
    // avoids leaking which emails are registered.
    if (!user) {
      await recordFailedAttempt();
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await recordFailedAttempt();
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Success — clear any past failed attempts for this email
    await attempts.deleteOne({ email: normalizedEmail });

    const token = jwt.sign(
      { userId: user._id, email: user.email, tier: user.tier || "free" },
      JWT_SECRET,
      { expiresIn: "7d", algorithm: "HS256" }
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
