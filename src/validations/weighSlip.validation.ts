import Joi from "joi";

export const createWeighSlipSchema = Joi.object({
  slipNo: Joi.string().required(),
  entries: Joi.array()
    .items(
      Joi.object({
        srNo: Joi.number().required(),
        gross: Joi.number().positive().required(),
        tare: Joi.number().positive().required(),
      }),
    )
    .min(1)
    .required(),
});
