// api/backtest-report.js
// GET /api/backtest-report
// PUBLIC — no login required. Free users see this.
//
// Builds ALL THREE reports from the PDF, per year, for the rolling
// 5-year window (2020-2025 now; drops 2020 once 2026 completes):
//   1. Validation Report      — signal counts + opportunity rate
//   2. Profit Validation      — win rate + avg return per signal
//   3. SIP Simulation         — regular vs rule-based SIP, XIRR
//
// Source: your single Google Sheet ("NIFTY Data"), via ?type=backtest
// on the same Apps Script Web App URL already used for the live snapshot.

const SHEET_BASE_URL =
  "https://script.google.com/macros/s/AKfycbxYGJrFCvJxlKhfFciY1slTPzKx4-JkoJPFzW0weYfc4aHQgsRiQunOxb4xsQTSb_D5/exec";

// ---------- helpers ----------

function parseDate(val) {
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    // ISO format from Apps Script Date cells: "2020-01-15T00:00:00.000Z"
    if (val.includes("T") || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return new Date(val);
    }
    // "DD/MM/YYYY" format (your actual sheet format, e.g. "31/12/2020")
    if (val.includes("/")) {
      const parts = val.split("/");
      if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }
    // "DD-MM-YYYY" format (fallback, dash-separated)
    if (val.includes("-")) {
      const parts = val.split("-");
      if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }
  }
  return null;
}

function signalMultiplier(signal) {
  if (signal === "AGGRESSIVE") return 3;
  if (signal === "STRONG") return 2;
  if (signal === "WATCH") return 1.5;
  return 1; // NEUTRAL
}

// Simple XIRR via Newton-Raphson. cashflows: [{amount, date}], amount negative = invested, positive = returned.
function computeXIRR(cashflows) {
  if (!cashflows.length) return null;
  const t0 = cashflows[0].date.getTime();
  const years = (d) => (d.getTime() - t0) / (365 * 24 * 60 * 60 * 1000);

  const npv = (rate) =>
    cashflows.reduce((sum, cf) => sum + cf.amount / Math.pow(1 + rate, years(cf.date)), 0);
  const npvDerivative = (rate) =>
    cashflows.reduce((sum, cf) => {
      const t = years(cf.date);
      return sum - (t * cf.amount) / Math.pow(1 + rate, t + 1);
    }, 0);

  let rate = 0.1;
  for (let i = 0; i < 50; i++) {
    const f = npv(rate);
    const fPrime = npvDerivative(rate);
    if (Math.abs(fPrime) < 1e-10) break;
    const newRate = rate - f / fPrime;
    if (!isFinite(newRate)) break;
    if (Math.abs(newRate - rate) < 1e-6) { rate = newRate; break; }
    rate = newRate;
  }
  return isFinite(rate) ? (rate * 100).toFixed(2) : null;
}

// ---------- main handler ----------

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sheetRes = await fetch(SHEET_BASE_URL + "?type=backtest");
    if (!sheetRes.ok) throw new Error("Sheet fetch failed: " + sheetRes.status);

    const rows = await sheetRes.json();
    if (!Array.isArray(rows) || rows.length < 2) {
      throw new Error("Unexpected sheet format");
    }

    const headers = rows[0];
    const dateIdx = headers.indexOf("Date");
    const closeIdx = headers.indexOf("Nifty Close");
    const signalIdx = headers.indexOf("Signal");

    // Build a clean, chronologically sorted series
    let series = rows.slice(1)
      .map((row) => ({
        date: parseDate(row[dateIdx]),
        close: parseFloat(row[closeIdx]),
        signal: row[signalIdx] || "NEUTRAL",
      }))
      .filter((r) => r.date && !isNaN(r.close))
      .sort((a, b) => a.date - b.date);

    // Pre-compute forward returns (Q1=63, Q2=126, Q3=189, Q4=252 trading days ahead)
    // using array-index offsets, same as the PDF's OFFSET-based formulas.
    const OFFSETS = { q1: 63, q2: 126, q3: 189, q4: 252 };
    series = series.map((r, i) => {
      const fwd = {};
      for (const [key, off] of Object.entries(OFFSETS)) {
        const future = series[i + off];
        fwd[key] = future ? ((future.close - r.close) / r.close) * 100 : null;
      }
      return { ...r, fwd, year: r.date.getFullYear() };
    });

    const currentYear = new Date().getFullYear();
    const lastCompletedYear = currentYear - 1;
    const windowStart = lastCompletedYear - 4;

    const years = [];

    for (let y = windowStart; y <= lastCompletedYear; y++) {
      const yearRows = series.filter((r) => r.year === y);
      if (yearRows.length === 0) continue;

      // ---- Report 1: Validation ----
      const counts = { NEUTRAL: 0, WATCH: 0, STRONG: 0, AGGRESSIVE: 0 };
      yearRows.forEach((r) => { counts[r.signal] = (counts[r.signal] || 0) + 1; });
      const opportunityCount = counts.WATCH + counts.STRONG + counts.AGGRESSIVE;
      const validation = {
        totalRows: yearRows.length,
        neutralCount: counts.NEUTRAL,
        watchCount: counts.WATCH,
        strongCount: counts.STRONG,
        aggressiveCount: counts.AGGRESSIVE,
        opportunityRatePct: ((opportunityCount / yearRows.length) * 100).toFixed(2),
      };

      // ---- Report 2: Profit Validation (win rate + avg return, using Q2/126-day) ----
      function winRateAndAvg(signalName) {
        const rowsWithSignal = yearRows.filter((r) => r.signal === signalName && r.fwd.q2 != null);
        if (!rowsWithSignal.length) return { winRatePct: null, avgReturnPct: null };
        const wins = rowsWithSignal.filter((r) => r.fwd.q2 > 0).length;
        const avg = rowsWithSignal.reduce((s, r) => s + r.fwd.q2, 0) / rowsWithSignal.length;
        return {
          winRatePct: ((wins / rowsWithSignal.length) * 100).toFixed(2),
          avgReturnPct: avg.toFixed(2),
        };
      }
      const profitValidation = {
        watch: winRateAndAvg("WATCH"),
        strong: winRateAndAvg("STRONG"),
        aggressive: winRateAndAvg("AGGRESSIVE"),
        neutral: winRateAndAvg("NEUTRAL"),
      };

      // ---- Report 3: SIP Simulation (12 monthly SIP dates within the year) ----
      const REGULAR_AMOUNT = 5000;
      const sipDates = [];
      for (let m = 0; m < 12; m++) {
        // first trading day on/after the 1st of each month
        const found = yearRows.find((r) => r.date.getMonth() === m);
        if (found) sipDates.push(found);
      }

      let investedRegular = 0, investedRule = 0, unitsRegular = 0, unitsRule = 0;
      const cashflowsRegular = [], cashflowsRule = [];

      sipDates.forEach((r) => {
        const ruleAmount = REGULAR_AMOUNT * signalMultiplier(r.signal);
        investedRegular += REGULAR_AMOUNT;
        investedRule += ruleAmount;
        unitsRegular += REGULAR_AMOUNT / r.close;
        unitsRule += ruleAmount / r.close;
        cashflowsRegular.push({ amount: -REGULAR_AMOUNT, date: r.date });
        cashflowsRule.push({ amount: -ruleAmount, date: r.date });
      });

      const lastRowOfYear = yearRows[yearRows.length - 1];
      const exitClose = lastRowOfYear ? lastRowOfYear.close : null;
      const exitDate = lastRowOfYear ? lastRowOfYear.date : null;

      let sipSimulation = null;
      if (exitClose && sipDates.length > 0) {
        const currentValueRegular = unitsRegular * exitClose;
        const currentValueRule = unitsRule * exitClose;

        cashflowsRegular.push({ amount: currentValueRegular, date: exitDate });
        cashflowsRule.push({ amount: currentValueRule, date: exitDate });

        sipSimulation = {
          totalInvestedRegular: investedRegular.toFixed(2),
          totalInvestedRule: investedRule.toFixed(2),
          currentValueRegular: currentValueRegular.toFixed(2),
          currentValueRule: currentValueRule.toFixed(2),
          returnPctRegular: (((currentValueRegular - investedRegular) / investedRegular) * 100).toFixed(2),
          returnPctRule: (((currentValueRule - investedRule) / investedRule) * 100).toFixed(2),
          xirrRegular: computeXIRR(cashflowsRegular),
          xirrRule: computeXIRR(cashflowsRule),
        };
      }

      years.push({ year: y, validation, profitValidation, sipSimulation });
    }

    return res.status(200).json({ windowStart, windowEnd: lastCompletedYear, years });
  } catch (err) {
    console.error("Backtest report error:", err);
    return res.status(500).json({ error: "Unable to load backtest report right now." });
  }
};
