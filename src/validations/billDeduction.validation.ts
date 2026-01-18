import Joi from "joi";

export const addDeductionsSchema = Joi.object({
  deductions: Joi.array()
    .items(
      Joi.object({
        label: Joi.string().required(),
        value: Joi.number().positive().required(),
      }),
    )
    .min(1)
    .required(),
});
