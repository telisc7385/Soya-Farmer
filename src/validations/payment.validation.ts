import Joi from "joi";

export const payFarmerSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paidDate: Joi.string().optional(),
  reference: Joi.string().optional(),
  remarks: Joi.string().allow("").optional(),
});
export const rejectFarmerSchema = Joi.object({
  reason: Joi.string().required(),
});

export const createAdvanceSchema = Joi.object({
  amount: Joi.number().positive().required(),
  source: Joi.string().valid("PROFILE", "BILLING").default("PROFILE"),
  reason: Joi.string()
    .valid(
      "PRE_SEASON_ADVANCE",
      "VEHICLE_RENT",
      "LABOUR_CHARGES",
      "DIESEL_EXPENSE",
      "EMERGENCY_EXPENSE",
      "OTHER",
    )
    .required(),
  remarks: Joi.string().allow("").optional(),
  billId: Joi.string().optional(),
});

export const createSettlementSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paidDate: Joi.string().optional(),
  reference: Joi.string().allow("").optional(),
  remarks: Joi.string().allow("").optional(),
});
