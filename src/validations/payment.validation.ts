import Joi from "joi";

export const payFarmerSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paidDate: Joi.string().optional(),
  reference: Joi.string().optional(),
});
export const rejectFarmerSchema = Joi.object({
  reference: Joi.string().required(),
});
