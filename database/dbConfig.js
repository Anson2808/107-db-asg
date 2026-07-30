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

    // Auto-migrate Feedback table if OwnerReply is missing
    const colCheck = await sql.query`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Feedback' AND COLUMN_NAME = 'OwnerReply'
    `;
    if (colCheck.recordset.length === 0) {
      await sql.query`
        ALTER TABLE dbo.Feedback ADD OwnerReply NVARCHAR(1000) NULL, RepliedAt DATETIME NULL;
      `;
      console.log('Migrated dbo.Feedback: Added OwnerReply and RepliedAt columns.');
    }
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = { sql, dbConfig, connectDB };
