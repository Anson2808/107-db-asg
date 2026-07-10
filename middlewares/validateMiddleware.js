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

// Add to cart schema
const addToCartSchema = Joi.object({
  menuItemId: Joi.number().integer().required(),
  quantity: Joi.number().integer().min(1).default(1),
});

// Update cart quantity schema
const updateCartQuantitySchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  updateStallSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  addToCartSchema,
  updateCartQuantitySchema,
};
