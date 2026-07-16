// api/get-snapshot.js
// GET /api/get-snapshot
// PUBLIC / FREE endpoint. Deliberately returns ONLY Date + Nifty Close.
//
// IMPORTANT: Do NOT add correctionPct, marketStatus/signal, sipAction,
// or 52-Week High to this response. Those are paid-only data — exposing
// them here (even if the frontend doesn't display them) would let anyone
// read them straight from the network response. Paid data lives in
// /api/notification-latest.js instead, gated behind login + JWT tier check.

const SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxYGJrFCvJxlKhfFciY1slTPzKx4-JkoJPFzW0weYfc4aHQgsRiQunOxb4xsQTSb_D5/exec";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sheetRes = await fetch(SHEET_WEB_APP_URL);
    if (!sheetRes.ok) {
      throw new Error("Google Sheet fetch failed with status " + sheetRes.status);
    }

    const rows = await sheetRes.json();

    if (!Array.isArray(rows) || rows.length < 2) {
      throw new Error("Unexpected sheet format");
    }

    const headers = rows[0];
    const values = rows[1];

    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });

    // ONLY these two fields — nothing else, by design.
    const date = row["Date"] || "--";
    const lastClose = row["Nifty Close"] || "--";

    return res.status(200).json({ date, lastClose });
  } catch (err) {
    console.error("Snapshot fetch error:", err);
    return res.status(500).json({ error: "Unable to fetch snapshot right now." });
  }
};
