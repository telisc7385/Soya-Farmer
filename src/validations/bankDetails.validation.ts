import Joi from "joi";

export const createBankDetailsSchema = Joi.object({
  bankName: Joi.string().trim().required(),
  ifsc: Joi.string().trim().uppercase().required(),
});
