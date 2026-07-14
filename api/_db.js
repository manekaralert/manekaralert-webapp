// api/_db.js
// Shared MongoDB connection helper for all serverless functions.
// Reuses the connection across warm invocations (important on Vercel).

const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "manekaralert";

if (!uri) {
  throw new Error(
    "MONGODB_URI is not set. Add it in Vercel → Project → Settings → Environment Variables."
  );
}

let cachedClient = global._manekarMongoClient;
let cachedDb = global._manekarMongoDb;

async function getDb() {
  if (cachedDb) return cachedDb;

  const client = cachedClient || new MongoClient(uri);
  if (!cachedClient) {
    await client.connect();
    cachedClient = client;
    global._manekarMongoClient = client;
  }

  cachedDb = client.db(dbName);
  global._manekarMongoDb = cachedDb;
  return cachedDb;
}

module.exports = { getDb };
