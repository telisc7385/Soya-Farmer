import Joi from "joi";

export const createVehicleSchema = Joi.object({
  vehicleNo: Joi.string()
    .trim()
    .min(5)
    .pattern(/^\S+$/) // ❌ No spaces allowed
    .required()
    .messages({
      "string.pattern.base": "Vehicle number must not contain spaces",
    }),
});

export const updateVehicleSchema = Joi.object({
  vehicleNo: Joi.string()
    .trim()
    .min(5)
    .pattern(/^\S+$/) // ❌ No spaces allowed
    .required()
    .messages({
      "string.pattern.base": "Vehicle number must not contain spaces",
    }),
});
