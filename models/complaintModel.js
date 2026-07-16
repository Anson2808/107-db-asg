const { sql } = require("../database/dbConfig");

async function createComplaint({ stallId, userId, category, description }) {
  const result = await sql.query`
    INSERT INTO Complaints (StallId, UserId, Category, Description)
    OUTPUT INSERTED.ComplaintId
    VALUES (${stallId}, ${userId}, ${category}, ${description})
  `;

  return result.recordset[0].ComplaintId;
}

async function getComplaintById(complaintId) {
  const result = await sql.query`
    SELECT
      c.ComplaintId, c.StallId, c.UserId, c.Category, c.Description,
      c.Status, c.CreatedAt, s.StallName, s.CuisineType
    FROM Complaints c
    JOIN Stalls s ON c.StallId = s.StallId
    WHERE c.ComplaintId = ${complaintId}
  `;

  return result.recordset[0];
}

module.exports = { createComplaint, getComplaintById };
