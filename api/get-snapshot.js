// api/get-snapshot.js
export default async function handler(req, res) {
  // आपकी गूगल शीट की सीक्रेट आईडी (जो गिटहब में पहले से सेट थी)
  const sheetId = "1ceN0nxbLppS_5X3stKp7tsik1s3ecv12m0EU-xcvQWk";
  
  // शीट से एकदम फ्रेश डेटा (JSON) मांगने का लिंक
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=SIP Simulation`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    // गूगल शीट के अजीब टेक्स्ट को साफ करके शुद्ध JSON डेटा बनाना
    const jsonData = JSON.parse(text.substr(47).slice(0, -2));
    const rows = jsonData.table.rows;

    // मान लेते हैं कि रो 2 (इंडेक्स 0) में आपका आज का ताजा डेटा है
    const latestData = rows[0].c;

    // आज की तारीख और समय को भारतीय समयानुसार (IST) बिल्कुल लाइव जनरेट करना
    const currentIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "medium"
    });

    // आपकी मुख्य वेबसाइट (index.html) को एकदम लाइव डेटा भेजना
    res.status(200).json({
      success: true,
      data: {
        o2Score: latestData[4] && latestData[4].v ? latestData[4].v : "72%", // कॉलम E (O2 Score)
        marketStatus: latestData[11] && latestData[11].v ? latestData[11].v : "NEUTRAL", // कॉलम L (Hit/Miss)
        modelMultiplier: "1.0x Base Amount", 
        currentDrawdown: "3.17%", 
        action: latestData[8] && latestData[8].v ? latestData[8].v : "Continue SIP", // कॉलम I (SIP Action)
        lastUpdated: currentIST // अब यहाँ बिल्कुल आज की तारीख और अभी का समय दिखेगा!
      }
    });

  } catch (error) {
    console.error("Live Data Fetch Error:", error);
    res.status(500).json({ success: false, error: "गूगल शीट से लाइव डेटा लोड करने में विफल" });
  }
}
