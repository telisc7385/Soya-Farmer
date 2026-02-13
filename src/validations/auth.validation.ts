import Joi from "joi";

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required(), // only digits, 10-15 chars
  password: Joi.string().min(6).required(),
  villageAdd: Joi.string().max(255).allow("", null).optional(),
  taluka: Joi.string().max(100).allow("", null).optional(),
  district: Joi.string().max(100).allow("", null).optional(),
  role: Joi.string().valid("VENDOR").optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const updateVendorSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .optional(),
  villageAdd: Joi.string().max(255).allow("", null).optional(),
  taluka: Joi.string().max(100).allow("", null).optional(),
  district: Joi.string().max(100).allow("", null).optional(),
}).min(1);
