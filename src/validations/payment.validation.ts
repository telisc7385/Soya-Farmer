import Joi, { optional } from "joi";

export const payFarmerSchema = Joi.object({
  amount: Joi.number().required(),
  paidDate: Joi.string().required(),
  reference: Joi.string().optional(),
});
export const rejectFarmerSchema = Joi.object({
  reference: Joi.string().required(),
});
