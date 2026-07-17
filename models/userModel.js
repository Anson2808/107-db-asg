const { sql } = require("../database/dbConfig");

async function getUserByUsername(username) {
  const result = await sql.query`SELECT * FROM Users WHERE Username = ${username}`;
  return result.recordset[0];
}

async function createUser({ username, passwordHash, email, fullName, role }) {
  const result = await sql.query`
    INSERT INTO Users (Username, PasswordHash, Email, FullName, Role)
    OUTPUT INSERTED.UserId
    VALUES (${username}, ${passwordHash}, ${email}, ${fullName}, ${role})
  `;
  return result.recordset[0].UserId;
}

async function getUserById(userId) {
  const result = await sql.query`
    SELECT UserId, Username, Email, FullName, Role, CreatedAt
    FROM Users WHERE UserId = ${userId}
  `;
  return result.recordset[0];
}

async function getUserWithHashById(userId) {
  const result = await sql.query`SELECT * FROM Users WHERE UserId = ${userId}`;
  return result.recordset[0];
}

async function updateUser(userId, fields) {
  const allowed = ["Email", "FullName", "PasswordHash"];
  const setClauses = [];
  const inputs = {};

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      const paramName = `param_${key}`;
      setClauses.push(`${key} = @${paramName}`);
      inputs[paramName] = { name: paramName, type: sql.NVarChar, value };
    }
  }

  if (setClauses.length === 0) return null;

  const request = new sql.Request();
  for (const [name, def] of Object.entries(inputs)) {
    request.input(def.name, def.type, def.value);
  }

  const query = `UPDATE Users SET ${setClauses.join(", ")} WHERE UserId = @userId`;
  request.input("userId", sql.Int, userId);

  await request.query(query);
  return true;
}

module.exports = { getUserByUsername, createUser, getUserById, getUserWithHashById, updateUser };
