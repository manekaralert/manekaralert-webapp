// api/get-snapshot.js
// GET /api/get-snapshot
// Fetches the latest row from your Google Sheet (via Apps Script Web App)
// and reshapes it into the JSON the frontend's loadSnapshot() expects:
// { sipScore, marketStatus, multiplier, high52w, lastClose }

// NOTE: If your repo already has an api/get-snapshot.js file, replace its
// contents with this file (don't create a duplicate).

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

    // Expecting: rows[0] = header row, rows[1] = latest data row
    if (!Array.isArray(rows) || rows.length < 2) {
      throw new Error("Unexpected sheet format");
    }

    const headers = rows[0];
    const values = rows[1];

    // Build a { headerName: value } lookup so we don't depend on column order
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });

    // Map sheet columns -> frontend fields
    const lastClose = row["Nifty Close"] || "--";
    const high52w = row["52 Week High"] || "--";
    const marketStatus = row["Signal"] || "--";
    const sipAction = row["SIP Action"] || "";
    // Second "O2 Score" column (index 7) holds the live score, not the header-duplicate at index 4
    const sipScore = values[7] !== "" && values[7] != null ? values[7] : 0;

    return res.status(200).json({
      sipScore,
      marketStatus,
      multiplier: sipAction || "--",
      high52w,
      lastClose,
    });
  } catch (err) {
    console.error("Snapshot fetch error:", err);
    return res.status(500).json({ error: "Unable to fetch live snapshot right now." });
  }
};

