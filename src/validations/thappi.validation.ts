import Joi from "joi";

export const createThappiSchema = Joi.object({
  locationId: Joi.string().uuid().required(),
  weightQtl: Joi.number().positive().required(),
  moisture: Joi.number().min(0).max(100).optional(),
  fm: Joi.number().min(0).max(100).optional(),
  damage: Joi.number().min(0).max(100).optional(),
  bagBreakdown: Joi.array()
    .items(
      Joi.object({
        goniTypeId: Joi.string().uuid().required(),
        bagCount: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
});

export const listThappiQuerySchema = Joi.object({
  locationId: Joi.string().uuid().optional(),
  status: Joi.string().valid("AVAILABLE", "TRANSFERRED").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const updateThappiQualitySchema = Joi.object({
  moisture: Joi.number().min(0).max(100).required(),
  fm: Joi.number().min(0).max(100).required(),
  damage: Joi.number().min(0).max(100).required(),
});
