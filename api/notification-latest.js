// api/notification-latest.js
// GET /api/notification-latest
// Header: Authorization: Bearer <token>  (the JWT saved after login)
//
// Returns the most recent RULE-TRIGGERED signal only (ruleTriggered: true).
// If the market has been NEUTRAL for a while, this correctly returns
// "no active alert" instead of manufacturing a daily notification.
// Free/unauthenticated users get a 403.

const { getDb } = require("./_db");
const { getUserFromRequest } = require("./_auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Please log in to view alerts." });
  }
  if (user.tier !== "premium") {
    return res.status(403).json({ error: "This alert is available to Premium investors only." });
  }

  try {
    const db = await getDb();
    const signals = db.collection("dailySignals");

    const latest = await signals
      .find({ ruleTriggered: true })
      .sort({ date: -1 })
      .limit(1)
      .toArray();

    if (!latest.length) {
      return res.status(200).json({
        active: false,
        message: "No active signal right now — market is within normal range (NEUTRAL).",
      });
    }

    return res.status(200).json({ active: true, ...latest[0] });
  } catch (err) {
    console.error("Notification fetch error:", err);
    return res.status(500).json({ error: "Unable to fetch alert." });
  }
};
