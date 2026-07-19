require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sql, dbConfig } = require("./dbConfig");

async function runSeed() {
  const seedPath = path.join(__dirname, "seed.sql");
  const seedSql = fs.readFileSync(seedPath, "utf8");

  await sql.connect(dbConfig);

  // Split on GO (case-insensitive) to run as separate batches
  const batches = seedSql.split(/\n\s*GO\s*\n/i).filter(b => b.trim());
  for (const batch of batches) {
    await sql.query(batch);
  }

  console.log(`Seeded database "${dbConfig.database}" on ${dbConfig.server}`);
}

runSeed()
  .catch((err) => {
    console.error("Failed to seed database:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.close();
  });
