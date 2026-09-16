import Joi from "joi";

export const createInventoryLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  isActive: Joi.boolean().optional(),
});

export const updateInventoryLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  code: Joi.string().trim().max(40).allow(null, "").optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

export const listInventoryLocationQuerySchema = Joi.object({
  isActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const assignVendorLocationsSchema = Joi.object({
  locationIds: Joi.array().items(Joi.string().uuid()).required(),
});

export const assignLocationVendorsSchema = Joi.object({
  vendorIds: Joi.array().items(Joi.string().uuid()).required(),
});