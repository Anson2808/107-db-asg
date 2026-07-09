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

module.exports = { validate, registerSchema };
