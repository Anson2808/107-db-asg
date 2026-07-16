require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sql, dbConfig } = require("./dbConfig");

async function runSeed() {
  const seedPath = path.join(__dirname, "seed.sql");
  const seedSql = fs.readFileSync(seedPath, "utf8");

  await sql.connect(dbConfig);
  await sql.query(seedSql);
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
