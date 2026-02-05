import Joi from "joi";

export const createFarmerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required(),
  aadhaarNo: Joi.string().length(12).required(),
  email: Joi.string().email().required(),

  villageAdd: Joi.string().optional(),
  gutNumber: Joi.string().optional(),
  taluka: Joi.string().optional(),
  district: Joi.string().optional(),
});

export const farmerDocumentSchema = Joi.object({
  farmerId: Joi.string().uuid().required(),
  type: Joi.string()
    .valid(
      "AADHAAR",
      "PAN",
      "DRIVING_LICENSE",
      "LAND_712",
      "BLOOD_RELATION_712",
    )
    .required(),
});

export const farmerLandSchema = Joi.object({
  locationId: Joi.string().uuid().required(),
  landType: Joi.string().valid("OWN", "BLOOD_RELATION").required(),
  area: Joi.number().positive().required(),
});

export const farmerBankSchema = Joi.object({
  bankName: Joi.string().required(),
  accountNo: Joi.string().required(),
  ifsc: Joi.string().required(),
  holderName: Joi.string().required(),
});
