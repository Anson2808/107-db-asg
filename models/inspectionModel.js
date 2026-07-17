const { sql } = require("../database/dbConfig");

async function getInspectionHistory(stallId) {
  const result = await sql.query`
    SELECT 
      InspectionId,
      InspectionDate,
      Grade,
      Score,
      Violations
    FROM Inspections
    WHERE StallId = ${stallId}
    ORDER BY InspectionDate ASC
  `;
  return result.recordset;
}

module.exports = { getInspectionHistory };
