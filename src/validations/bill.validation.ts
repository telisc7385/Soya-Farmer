import Joi from "joi";

export const saveBillSchema = Joi.object({
  billId: Joi.string().uuid().optional(),
  farmerId: Joi.string().uuid().optional(),
  billDate: Joi.date().optional(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().positive().required(),
        unit: Joi.string().valid("KG", "QTL").required(),
        rate: Joi.number().positive().required(),
        bagCount: Joi.number().integer().min(0).required(),
      }),
    )
    .optional(),
  deductions: Joi.array()
    .items(
      Joi.object({
        label: Joi.string().required(),
        value: Joi.number().positive().required(),
      }),
    )
    .optional(),
  slips: Joi.array()
    .items(
      Joi.object({
        slipNo: Joi.string().required(),
        entries: Joi.array()
          .items(
            Joi.object({
              srNo: Joi.number().integer().required(),
              gross: Joi.number().positive().required(),
              tare: Joi.number().min(0).required(),
            }),
          )
          .min(1)
          .required(),
      }),
    )
    .optional(),
});
