const sql = require("mssql");

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,               // false for local / non-Azure
    trustServerCertificate: true, // accept self-signed certs in dev
  },
};

async function connectDB() {
  try {
    await sql.connect(dbConfig);
    console.log(`Connected to database "${dbConfig.database}" on ${dbConfig.server}`);
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = { sql, dbConfig, connectDB };
