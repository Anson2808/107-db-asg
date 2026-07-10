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

async function addInspectionRecord({ stallId, date, grade, score, violations }) {
  const result = await sql.query`
    INSERT INTO Inspections (StallId, InspectionDate, Grade, Score, Violations)
    OUTPUT INSERTED.InspectionId
    VALUES (${stallId}, ${date}, ${grade}, ${score}, ${violations || null})
  `;
  return result.recordset[0].InspectionId;
}

module.exports = { getInspectionHistory, addInspectionRecord };