// api/cron/daily-signal.js
// Runs automatically once a day via Vercel Cron.
//
// What it does:
// 1. Reads the latest row from your existing Google Sheet Apps Script URL
//    (the SAME one get-snapshot.js already uses — no changes to Apps Script needed).
// 2. Stores that day's row in MongoDB "dailySignals" — this builds up your
//    historical record over time, used later for the free backtest report.
// 3. Marks the row as ruleTriggered = true ONLY if the Signal is not NEUTRAL
//    (i.e. your Sheet's own rule/condition actually fired — WATCH/STRONG/AGGRESSIVE).
//    Paid notifications are built from ruleTriggered rows only — so a
//    notification only appears when a real condition is met, not every day.
// 4. De-duplicates by date — running this twice on the same day does nothing extra.

const { getDb } = require("../_db");

const SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxYGJrFCvJxlKhfFciY1slTPzKx4-JkoJPFzW0weYfc4aHQgsRiQunOxb4xsQTSb_D5/exec";

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const sheetRes = await fetch(SHEET_WEB_APP_URL);
    if (!sheetRes.ok) throw new Error("Sheet fetch failed: " + sheetRes.status);

    const rows = await sheetRes.json();
    if (!Array.isArray(rows) || rows.length < 2) {
      throw new Error("Unexpected sheet format");
    }

    const headers = rows[0];
    const values = rows[1];
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });

    const todayDate = row["Date"];
    if (!todayDate) {
      return res.status(200).json({ message: "No new date in sheet yet. Skipped." });
    }

    const db = await getDb();
    const signals = db.collection("dailySignals");

    const existing = await signals.findOne({ date: todayDate });
    if (existing) {
      return res.status(200).json({ message: `Row for ${todayDate} already stored. Skipped.` });
    }

    const signal = row["Signal"] || "NEUTRAL";
    const ruleTriggered = signal !== "NEUTRAL" && signal !== "";

    const doc = {
      date: todayDate,
      close: row["Nifty Close"],
      high52w: row["52 Week High"],
      correctionPct: row["Correction %"],
      o2Score: values[7],
      validAlert: values[8],
      sipAction: row["SIP Action"],
      signal,
      ruleTriggered, // true only when WATCH/STRONG/AGGRESSIVE actually fires
      createdAt: new Date(),
    };

    await signals.insertOne(doc);

    return res.status(200).json({
      message: ruleTriggered
        ? `Rule triggered for ${todayDate} — notification created.`
        : `${todayDate} stored as NEUTRAL — no notification (as expected).`,
      doc,
    });
  } catch (err) {
    console.error("Daily signal cron error:", err);
    return res.status(500).json({ error: "Cron job failed." });
  }
};

