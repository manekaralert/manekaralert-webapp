import { MongoClient } from 'mongodb';

// यह आपके मोंगोडीबी का गुप्त कनेक्शन स्ट्रिंग है जो हम वर्सेल सेटिंग्स में डालेंगे
const uri = process.env.MONGODB_URI; 
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) return cachedClient;
    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
}

export default async function handler(req, res) {
    // सुरक्षा के लिए सिर्फ POST रिक्वेस्ट को अनुमति देंगे
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;
        const client = await connectToDatabase();
        const db = client.db('manekaralert_db'); // आपके मोंगोडीबी डेटाबेस का नाम
        
        // यूज़र्स कलेक्शन में ईमेल आईडी खोजना
        const user = await db.collection('users').findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(401).json({ success: false, message: 'इन्वेस्टर रिकॉर्ड नहीं मिला।' });
        }

        // पासवर्ड मैच करना
        if (user.password !== password) {
            return res.status(401).json({ success: false, message: 'गलत पासवर्ड! कृपया दोबारा जांचें।' });
        }

        // सफलता का रिस्पॉन्स
        return res.status(200).json({ 
            success: true, 
            message: 'Authentication Successful!',
            user: { email: user.email, name: user.name || 'Investor' } 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'सर्वर त्रुटि: ' + error.message });
    }
}
