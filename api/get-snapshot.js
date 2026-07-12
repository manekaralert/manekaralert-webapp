// api/get-snapshot.js
export default async function handler(req, res) {
  // सुरक्षा जांच
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // 1. सीधे लाइव मार्केट से निफ्टी 50 का बिल्कुल ताजा भाव खींचना
    const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1d');
    if (!response.ok) throw new Error('Yahoo Finance API failed');
    
    const data = await response.json();
    const niftyClose = data.chart.result[0].indicators.quote[0].close[0];

    // 2. आपका सुरक्षित और गुप्त फॉर्मूला (Black Box Logic)
    // 52-Week High को हम बेस मानकर चल रहे हैं (आप इसे अपनी रणनीति के अनुसार बदल सकते हैं)
    const rollingHigh = 25000; 
    const drawdown = ((rollingHigh - niftyClose) / rollingHigh) * 100;
    
    let marketStatus = "NEUTRAL";
    let modelMultiplier = "1.0x Base Amount";
    let o2Score = "50%";
    let action = "Continue SIP";

    // नियम-आधारित (Rule-Based) एल्गोरिदम जो बाहर किसी को नहीं दिखेगा
    if (drawdown > 5 && drawdown <= 10) {
      marketStatus = "ACCUMULATE";
      modelMultiplier = "1.5x Base Amount";
      o2Score = "75%";
      action = "Increase SIP Amount";
    } else if (drawdown > 10) {
      marketStatus = "AGGRESSIVE BUY";
      modelMultiplier = "2.0x Base Amount";
      o2Score = "100%";
      action = "Deploy Top-up Capital";
    } else if (drawdown < -2) {
      marketStatus = "OVERVALUED";
      modelMultiplier = "0.5x Base Amount";
      o2Score = "25%";
      action = "Hold Extra Cash";
    }

    // 3. वेबसाइट को सिर्फ अंतिम नतीजा भेजना (सुरक्षित आउटपुट)
    return res.status(200).json({
      success: true,
      data: {
        o2Score: o2Score,                // कॉलम E (O2 Score)
        marketStatus: marketStatus,      // कॉलम L (Hit/Miss या Signal)
        modelMultiplier: modelMultiplier, // आपका मल्टीप्लायर
        currentDrawdown: drawdown.toFixed(2) + "%",
        action: action,                  // कॉलम I (SIP Action)
        lastUpdated: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      }
    });

  } catch (error) {
    console.error("Error fetching live market data:", error);
    // अगर लाइव API काम न करे, तो सिस्टम क्रैश नहीं होगा (जीरो रिस्क बैकअप)
    return res.status(500).json({ 
      success: false, 
      error: "डेटा लोड करने में विफल",
      message: error.message 
    });
  }
}
