const { sql } = require("../database/dbConfig");

async function createStall({ ownerId, stallName, cuisineType }) {
  const result = await sql.query`
    INSERT INTO Stalls (OwnerId, StallName, CuisineType, Description, Status)
    OUTPUT INSERTED.StallId
    VALUES (${ownerId}, ${stallName}, ${cuisineType}, NULL, 'open')
  `;
  return result.recordset[0].StallId;
}

async function getStallByOwnerId(ownerId) {
  const result = await sql.query`SELECT * FROM Stalls WHERE OwnerId = ${ownerId}`;
  return result.recordset[0];
}

async function updateStall(stallId, fields) {
  const allowed = ["StallName", "Description", "CuisineType", "Status"];
  const setClauses = [];
  const inputs = {};

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      if (value === null) {
        setClauses.push(`${key} = NULL`);
      } else {
        const paramName = `param_${key}`;
        setClauses.push(`${key} = @${paramName}`);
        inputs[paramName] = { name: paramName, type: sql.NVarChar, value };
      }
    }
  }

  if (setClauses.length === 0) return null;

  const request = new sql.Request();
  for (const [name, def] of Object.entries(inputs)) {
    request.input(def.name, def.type, def.value);
  }

  const query = `UPDATE Stalls SET ${setClauses.join(", ")} WHERE StallId = @stallId`;
  request.input("stallId", sql.Int, stallId);

  await request.query(query);
  return true;
}

module.exports = { createStall, getStallByOwnerId, updateStall };
