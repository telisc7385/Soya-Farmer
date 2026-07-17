import Joi from "joi";

export const createDraftSchema = Joi.object({
  billId: Joi.string().uuid().optional(),
  farmerId: Joi.string().uuid().when("billId", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  billDate: Joi.date().optional(),
  quantity: Joi.number().positive().when("billId", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  unit: Joi.string()
    .valid("QTL", "MT", "KG")
    .when("billId", {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
  rate: Joi.number().positive().when("billId", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  vehicleNumber: Joi.string().trim().when("billId", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  vehicleType: Joi.string().trim().when("billId", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  driverName: Joi.string().trim().when("billId", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  billLocation: Joi.string().trim().optional(),
});

export const calculateDeductionSchema = Joi.object({
  deductions: Joi.array()
    .items(
      Joi.object({
        masterId: Joi.string().uuid().required(),
        actualInputs: Joi.object()
          .pattern(Joi.string(), Joi.number().min(0))
          .optional(),
        customInputs: Joi.object()
          .pattern(Joi.string(), Joi.number().min(0))
          .optional(),
      }),
    )
    .min(1)
    .required(),
});

export const applyGoniSchema = Joi.object({
  gonis: Joi.array()
    .items(
      Joi.object({
        goniTypeId: Joi.string().uuid().required(),
        bagCount: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
});
