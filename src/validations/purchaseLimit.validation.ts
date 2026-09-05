import Joi from "joi";

export const createPurchaseLimitSchema = Joi.object({
  value: Joi.number().positive().required(),
  note: Joi.string().trim().max(500).optional(),
});