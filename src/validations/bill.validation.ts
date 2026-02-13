import Joi from "joi";

export const createDraftSchema = Joi.object({
  farmerId: Joi.string().uuid().required(),
  billDate: Joi.date().optional(),
});

export const captureQuantitySchema = Joi.object({
  quantity: Joi.number().positive().required(),
  unit: Joi.string().valid("QTL", "MT").required(),
  rate: Joi.number().positive().required(),
});

export const calculateDeductionSchema = Joi.object({
  deductions: Joi.array()
    .items(
      Joi.object({
        masterId: Joi.string().uuid().required(),
        inputs: Joi.object()
          .pattern(Joi.string(), Joi.number().min(0))
          .optional(),
      }),
    )
    .min(1)
    .required(),
});

export const applyGoniSchema = Joi.object({
  goniTypeId: Joi.string().uuid().required(),
  bagCount: Joi.number().integer().min(0).required(),
});

export const confirmBillSchema = Joi.object({
  notes: Joi.string().max(500).optional(),
});
