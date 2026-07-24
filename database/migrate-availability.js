/**
 * One-off migration for SCRUM-86 (food availability).
 *
 * Use this INSTEAD of re-running runSeed.js when you want to keep the
 * data already in your database (registered users, orders, feedback).
 * If you don't mind wiping everything, just run `node database/runSeed.js`.
 *
 * Converts MenuItems.IsAvailable (BIT) into:
 *   Availability NVARCHAR(20) CHECK ('available','lowStock','soldOut')  <- source of truth
 *   IsAvailable  PERSISTED computed BIT (0 only when soldOut)           <- kept for existing code
 *
 * Safe to run twice: it exits early if Availability already exists.
 *
 * Run with:  node database/migrate-availability.js
 */
require("dotenv").config();

const { sql, dbConfig } = require("./dbConfig");

async function migrate() {
  await sql.connect(dbConfig);

  const existing = await sql.query`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'MenuItems' AND COLUMN_NAME = 'Availability'`;

  if (existing.recordset.length > 0) {
    console.log("Availability column already exists — nothing to do.");
    return;
  }

  // 1. Add the new source-of-truth column
  await sql.query(`
    ALTER TABLE dbo.MenuItems ADD Availability NVARCHAR(20) NOT NULL
      CONSTRAINT DF_MenuItems_Availability DEFAULT 'available'
      CONSTRAINT CK_MenuItems_Availability CHECK (Availability IN ('available','lowStock','soldOut'))`);
  console.log("1. Added Availability column");

  // 2. Carry over existing state (anything currently unavailable becomes sold out)
  await sql.query(`
    UPDATE dbo.MenuItems
    SET Availability = CASE WHEN IsAvailable = 0 THEN 'soldOut' ELSE 'available' END`);
  console.log("2. Backfilled Availability from IsAvailable");

  // 3. Drop the old BIT column — its DEFAULT constraint has a generated name,
  //    so look it up rather than hard-coding it.
  const defaults = await sql.query(`
    SELECT dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.MenuItems') AND c.name = 'IsAvailable'`);

  for (const row of defaults.recordset) {
    await sql.query(`ALTER TABLE dbo.MenuItems DROP CONSTRAINT [${row.name}]`);
  }
  await sql.query(`ALTER TABLE dbo.MenuItems DROP COLUMN IsAvailable`);
  console.log("3. Dropped the old IsAvailable BIT column");

  // 4. Re-add IsAvailable as a computed column derived from Availability
  await sql.query(`
    ALTER TABLE dbo.MenuItems ADD IsAvailable AS
      (CASE WHEN Availability = 'soldOut' THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END) PERSISTED`);
  console.log("4. Re-added IsAvailable as a computed column");

  const summary = await sql.query`
    SELECT Availability, COUNT(*) AS Items
    FROM dbo.MenuItems GROUP BY Availability ORDER BY Availability`;
  console.log("\nMigration complete:");
  summary.recordset.forEach((r) => console.log(`  ${r.Availability}: ${r.Items} item(s)`));
}

migrate()
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.close();
  });
