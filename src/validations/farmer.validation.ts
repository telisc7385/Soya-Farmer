import Joi from "joi";

export const createFarmerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required(),
  aadhaarNo: Joi.string().length(12).required(),
  panNo: Joi.string()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
    .required(),
  email: Joi.string().email().optional(),

  villageAdd: Joi.string().optional(),
  gutNumber: Joi.string().optional(),
  taluka: Joi.string().optional(),
  district: Joi.string().optional(),
});

export const farmerLandSchema = Joi.object({
  landType: Joi.string().valid("OWN", "BLOOD_RELATION").required(),
  area: Joi.number().positive().required(),
  villageAdd: Joi.string().optional(),
  taluka: Joi.string().optional(),
  district: Joi.string().optional(),
});

export const farmerBankSchema = Joi.object({
  bankName: Joi.string().required(),
  accountNo: Joi.string().required(),
  ifsc: Joi.string().required(),
  holderName: Joi.string().required(),
});
