require("dotenv").config();

const express = require("express");
const path = require("path");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const { connectDB } = require("./database/dbConfig");

const app = express();

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, "public")));
app.use("/menu_image", express.static(path.join(__dirname, "menu_image")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ==========================================
// MIDDLEWARES
// ==========================================
const {
  validate,
  registerSchema,
  loginSchema,
  updateStallSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  createOrderSchema,
  addToCartSchema,
  updateCartQuantitySchema,
  feedbackSchema,
  complaintSchema,
  updateProfileSchema,
} = require("./middlewares/validateMiddleware");
const { verifyJWT, requireRole } = require("./middlewares/authMiddleware");

// ==========================================
// ROUTES
// ==========================================

// Auth routes
const authController = require("./controllers/authController");
app.post("/api/auth/register", validate(registerSchema), authController.register);
app.post("/api/auth/login", validate(loginSchema), authController.login);

// Stall routes (owner only)
const stallController = require("./controllers/stallController");
app.get("/api/stalls", stallController.getAllStalls);
app.get("/api/stalls/:id/reviews", stallController.getStallReviews);
app.get("/api/stalls/my", verifyJWT, requireRole("stallOwner"), stallController.getMyStall);
app.put("/api/stalls/my", verifyJWT, requireRole("stallOwner"), validate(updateStallSchema), stallController.updateMyStall);

// Menu routes
const menuController = require("./controllers/menuController");
app.get("/api/menu", menuController.getAllMenuItems); // public — browsing + cart
app.post("/api/menu", verifyJWT, requireRole("stallOwner"), validate(createMenuItemSchema), menuController.addMenuItem);
app.post("/api/menu/:id/like", verifyJWT, requireRole("customer"), menuController.likeMenuItem);
app.put("/api/menu/:id", verifyJWT, requireRole("stallOwner"), validate(updateMenuItemSchema), menuController.updateMenuItem);
app.delete("/api/menu/:id", verifyJWT, requireRole("stallOwner"), menuController.deleteMenuItem);

// Analytics routes (owner only)
const analyticsController = require("./controllers/analyticsController");
app.get("/api/analytics/performance", verifyJWT, requireRole("stallOwner"), analyticsController.getPerformance);

// Satisfaction analytics route (accessible only to stall owners)
app.get("/api/analytics/satisfaction", verifyJWT, requireRole("stallOwner"), analyticsController.getSatisfaction);

// Inspections & Hygiene routes (owner only)
const inspectionController = require("./controllers/inspectionController");
app.get("/api/inspections/history", verifyJWT, requireRole("stallOwner"), inspectionController.getMyHygieneHistory);

// Feedback routes (customer only)
const feedbackController = require("./controllers/feedbackController");
app.post("/api/feedback", verifyJWT, requireRole("customer"), validate(feedbackSchema), feedbackController.submitFeedback);

// Complaint routes (customer only)
const complaintController = require("./controllers/complaintController");
app.post("/api/complaints", verifyJWT, requireRole("customer"), validate(complaintSchema), complaintController.submitComplaint);

// Order routes (any logged-in user)
const orderController = require("./controllers/orderController");
app.get("/api/orders/history", verifyJWT, orderController.getMyOrderHistory);
app.post("/api/orders", verifyJWT, validate(createOrderSchema), orderController.placeOrder);

// Cart routes (any logged-in user)
const cartController = require("./controllers/cartController");
app.post("/api/cart", verifyJWT, validate(addToCartSchema), cartController.addToCart);
app.get("/api/cart", verifyJWT, cartController.getCart);
app.put("/api/cart/:cartItemId", verifyJWT, validate(updateCartQuantitySchema), cartController.updateCartItem);
app.delete("/api/cart/:cartItemId", verifyJWT, cartController.removeFromCart);

// User profile routes (any logged-in user)
const userController = require("./controllers/userController");
app.get("/api/users/me", verifyJWT, userController.getMyProfile);
app.put("/api/users/me", verifyJWT, validate(updateProfileSchema), userController.updateMyProfile);

// ==========================================
// ERROR HANDLING (Must be last)
// ==========================================
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
