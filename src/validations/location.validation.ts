import Joi from "joi";

export const createLocationSchema = Joi.object({
  name: Joi.string().min(2).required(),
  quintalLimit: Joi.number().positive().required(),
});

export const updateLocationSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  quintalLimit: Joi.number().positive().optional(),
});
