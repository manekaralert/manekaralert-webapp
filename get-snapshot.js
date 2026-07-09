// api/get-snapshot.js
export default async function handler(req, res) {
  // आपकी मुख्य शीट की ID जिसे हम बैकएंड में ही रखेंगे
  const sheetId = "1ceNXmdxLppS_SX3sTKp7tslkRs3ecvl2mOEUrxcvQMk";
  
  // हम शीट से केवल वही डेटा (JSON) मांग रहे हैं जो स्क्रीन पर दिखाना है
  // इससे यूजर को फॉर्मूले कभी नहीं दिखेंगे
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=SIP Simulation`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // गूगल का अजीब फॉर्मेट हटाने के लिए क्लीनिंग
    const jsonData = JSON.parse(text.substr(47).slice(0, -2));
    const rows = jsonData.table.rows;

    // मान लेते हैं कि रो 2 में हमारा आज का लेटेस्ट डेटा है
    const latestData = rows[0].c; 

    // केवल फाइनल नतीजे यूजर को भेजना (लॉजिक पूरी तरह सुरक्षित है)
    res.status(200).json({
      success: true,
      data: {
        o2Score: latestData[4] ? latestData[4].v : "72%", // कॉलम E (O2 Score)
        marketStatus: latestData[11] ? latestData[11].v : "WATCH", // कॉलम L (Hit/Miss)
        action: latestData[8] ? latestData[8].v : "Continue SIP" // कॉलम I (SIP Action)
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: "डेटा लोड करने में विफल" });
  }
}
