// 404 handler for unknown /api routes
const notFound = (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Route not found" });
  }
  next();
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: err.message || "Internal Server Error" });
};

module.exports = { notFound, errorHandler };
