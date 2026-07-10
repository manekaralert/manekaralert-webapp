// Manekar Alert - Live Core Serverless Logic Engine
// Automated EOD Tracker sync sequence window set at 18:00 IST daily
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method framework not allowed' });
    }

    const { high, close } = req.body;

    // Check if parameters passed correctly
    if (high === undefined || close === undefined || close > high) {
        return res.status(400).json({ error: 'Calculation input variables mismatch' });
    }

    // Core mathematical logic execution
    const drawdown = ((high - close) / high) * 100;
    
    // Strict default values assigned for normal market conditions (User baseline)
    let bracket = "NEUTRAL";
    let score = 50;
    let multiplier = "1.0x Base Amount";

    // Matching strict reference schema rules and exact notification keywords
    if (drawdown >= 10 && drawdown < 15) {
        bracket = "WATCH"; // Phase A (10% Drawdown)
        score = 70;
        multiplier = "1.5x Multiplier";
    } else if (drawdown >= 15 && drawdown < 20) {
        bracket = "STRONG"; // Phase B (15% Drawdown)
        score = 80;
        multiplier = "2.0x Multiplier";
    } else if (drawdown >= 20) {
        bracket = "AGGRESSIVE"; // Phase C (20%+ Drawdown)
        score = 90;
        multiplier = "3.0x Multiplier";
    }

    // Securely return data layers to client shell at EOD execution
    return res.status(200).json({
        drawdown: drawdown.toFixed(2),
        bracket,
        score,
        multiplier
    });
}

