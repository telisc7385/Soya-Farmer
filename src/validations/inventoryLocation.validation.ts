import Joi from "joi";

export const createInventoryLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  type: Joi.string().valid("VENDOR", "GODOWN", "PLANT").required(),
  isActive: Joi.boolean().optional(),
});

export const updateInventoryLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  code: Joi.string().trim().max(40).allow(null, "").optional(),
  type: Joi.string().valid("VENDOR", "GODOWN", "PLANT").optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

export const listInventoryLocationQuerySchema = Joi.object({
  type: Joi.string().valid("VENDOR", "GODOWN", "PLANT").optional(),
  isActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});
