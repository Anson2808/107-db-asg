const { sql } = require("../database/dbConfig");

async function getInspectionHistory(stallId) {
  const result = await sql.query`
    SELECT 
      InspectionId,
      InspectionDate,
      Grade,
      Score,
      Violations,
      Notes
    FROM Inspections
    WHERE StallId = ${stallId}
    ORDER BY InspectionDate ASC
  `;
  return result.recordset;
}

async function addInspection({ stallId, inspectionDate, score, grade, violations, notes }) {
  const result = await sql.query`
    INSERT INTO Inspections (StallId, InspectionDate, Score, Grade, Violations, Notes)
    OUTPUT INSERTED.InspectionId
    VALUES (${stallId}, ${inspectionDate}, ${score}, ${grade}, ${violations || null}, ${notes || null})
  `;
  return result.recordset[0].InspectionId;
}

module.exports = { getInspectionHistory, addInspection };
