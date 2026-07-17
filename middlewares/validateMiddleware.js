const Joi = require("joi");

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }
    next();
  };
}

// Registration schema
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(8).required(),
  email: Joi.string().email().required(),
  fullName: Joi.string().required(),
  role: Joi.string().valid("customer", "stallOwner").required(),
  stallName: Joi.string().when("role", {
    is: "stallOwner",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  cuisineType: Joi.string().when("role", {
    is: "stallOwner",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

// Login schema
const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

// Update stall schema
const updateStallSchema = Joi.object({
  stallName: Joi.string().optional(),
  description: Joi.string().allow("").optional(),
  cuisineType: Joi.string().optional(),
  status: Joi.string().valid("open", "closed").optional(),
}).min(1);

// Create menu item schema
const createMenuItemSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().greater(0).required(),
  description: Joi.string().allow("").optional(),
  isAvailable: Joi.boolean().default(true).optional(),
});

// Update menu item schema
const updateMenuItemSchema = Joi.object({
  name: Joi.string().optional(),
  price: Joi.number().greater(0).optional(),
  description: Joi.string().allow("").optional(),
  isAvailable: Joi.boolean().optional(),
}).min(1);

// Create order schema
const createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        menuItemId: Joi.number().integer().required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
  paymentMethod: Joi.string()
    .valid("credit_card", "debit_card", "paynow", "cash", "gift_card")
    .required(),
});

// Add to cart schema
const addToCartSchema = Joi.object({
  menuItemId: Joi.number().integer().required(),
  quantity: Joi.number().integer().min(1).default(1),
});

// Update cart quantity schema
const updateCartQuantitySchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

// Submit feedback schema
const feedbackSchema = Joi.object({
  stallId: Joi.number().integer().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().min(1).max(1000).required(),
});

// Submit complaint schema
const complaintSchema = Joi.object({
  stallId: Joi.number().integer().required(),
  category: Joi.string()
    .valid("Poor hygiene", "Bad service", "Wrong order", "Food quality", "Other")
    .required(),
  description: Joi.string().trim().min(1).max(1000).required(),
});

// Update profile schema
const updateProfileSchema = Joi.object({
  email: Joi.string().email().optional(),
  fullName: Joi.string().optional(),
  currentPassword: Joi.string().optional(),
  newPassword: Joi.string().min(8).optional(),
})
  .min(1)
  .and("currentPassword", "newPassword");

module.exports = {
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
};
