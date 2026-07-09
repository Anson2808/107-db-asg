const { sql } = require("../database/dbConfig");

async function createStall({ ownerId, stallName, cuisineType }) {
  const result = await sql.query`
    INSERT INTO Stalls (OwnerId, StallName, CuisineType, Description, Status)
    OUTPUT INSERTED.StallId
    VALUES (${ownerId}, ${stallName}, ${cuisineType}, NULL, 'open')
  `;
  return result.recordset[0].StallId;
}

module.exports = { createStall };
