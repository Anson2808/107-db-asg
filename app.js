require("dotenv").config();

const express = require("express");
const path = require("path");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const { connectDB, sql } = require("./database/dbConfig");

const app = express();

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Auth routes
const { validate, registerSchema } = require("./middlewares/validateMiddleware");
const authController = require("./controllers/authController");
app.post("/api/auth/register", validate(registerSchema), authController.register);

// Error handling (last)
app.use(notFound);
app.use(errorHandler);

// Start server after DB connects
(async () => {
  await connectDB();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();

module.exports = app;


