import Joi from "joi";

export const updatePurchaseLimitSchema = Joi.object({
  value: Joi.number().positive().required(),
});
