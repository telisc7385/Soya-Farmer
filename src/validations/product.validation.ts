import Joi from "joi";

export const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  type: Joi.string().valid("KATTA", "SOYAPRODUCT").required(),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  type: Joi.string().valid("KATTA", "SOYAPRODUCT").optional(),
});
