import Joi from "joi";

// =====================
// TRANSFER VALIDATIONS
// =====================
export const createTransferSchema = Joi.object({
  weight: Joi.number().positive().optional(),
  unit: Joi.string().valid("QTL", "MT").optional(),
  bagCount: Joi.number().integer().min(0).required(),
  goniTypeId: Joi.string().uuid().optional(),
  shopName: Joi.string().max(255).required(),
  shopLocation: Joi.string().max(255).required(),
  vehicalNumber: Joi.string().max(50).optional(),
});

export const listTransferQuerySchema = Joi.object({
  status: Joi.string().valid("PENDING", "COMPLETED", "CANCELLED").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const updateTransferSchema = Joi.object({
  weight: Joi.number().positive().required(),
  unit: Joi.string().valid("QTL", "MT").required(),
}).or("weight", "unit");
