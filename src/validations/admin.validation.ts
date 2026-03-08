import Joi from "joi";

const deductionVariableSchema = Joi.object({
  code: Joi.string().trim().required(),
  label: Joi.string().trim().required(),
  unitHint: Joi.string().trim().optional(),
});

export const createDeductionMasterSchema = Joi.object({
  name: Joi.string().trim().required(),
  type: Joi.string().valid("FIXED", "FORMULA").required(),
  baseAmount: Joi.number().positive().when("type", {
    is: "FIXED",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  formulaExpression: Joi.string().when("type", {
    is: "FORMULA",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  variableValues: Joi.array()
    .items(Joi.alternatives().try(Joi.number(), Joi.string().trim()))
    .optional(),
  variables: Joi.array().items(deductionVariableSchema).optional(),
});

export const updateDeductionMasterSchema = Joi.object({
  name: Joi.string().trim().required(),
  type: Joi.string().valid("FIXED", "FORMULA").required(),
  baseAmount: Joi.number().positive().when("type", {
    is: "FIXED",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  formulaExpression: Joi.string().when("type", {
    is: "FORMULA",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  variableValues: Joi.array()
    .items(Joi.alternatives().try(Joi.number(), Joi.string().trim()))
    .optional(),
  variables: Joi.array().items(deductionVariableSchema).optional(),
});

export const toggleDeductionMasterSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

export const createGoniTypeSchema = Joi.object({
  name: Joi.string().trim().required(),
  weightPerBag: Joi.number().positive().required(),
  isTracked: Joi.boolean().optional(),
});

export const updateGoniTypeSchema = Joi.object({
  name: Joi.string().trim().required(),
  weightPerBag: Joi.number().positive().required(),
  isActive: Joi.boolean().required(),
  isTracked: Joi.boolean().optional(),
});

export const saveQualityRateSchema = Joi.object({
  quality: Joi.string().trim().max(100).required(),
  rate: Joi.number().positive().required(),
  isActive: Joi.boolean().optional(),
});
