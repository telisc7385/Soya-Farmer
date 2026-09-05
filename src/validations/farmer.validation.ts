import Joi from "joi";

export const farmerListQuerySchema = Joi.object({
  page: Joi.alternatives().try(Joi.number().min(1), Joi.string().pattern(/^\d+$/)).optional(),
  limit: Joi.alternatives().try(Joi.number().min(1), Joi.string().pattern(/^\d+$/)).optional(),
  search: Joi.string().allow("").optional(),
  adhar_no: Joi.string().allow("").optional(),
  vendorId: Joi.string().allow("").optional(),
  district: Joi.string().allow("").optional(),
  taluka: Joi.string().allow("").optional(),
  villageAdd: Joi.string().allow("").optional(),
  startDate: Joi.date().iso().allow("").optional(),
  endDate: Joi.date().iso().allow("").optional(),
  kycStatus: Joi.string().trim().allow("").optional(),
}).unknown(true);

export const createFarmerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required(),
  aadhaarNo: Joi.string().length(12).required(),
  panNo: Joi.string()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
    .optional(),
  email: Joi.string().email().optional(),

  villageAdd: Joi.string().optional(),
  taluka: Joi.string().optional(),
  district: Joi.string().optional(),
});

export const farmerLandSchema = Joi.object({
  landType: Joi.string().valid("OWN", "BLOOD_RELATION").required(),
  landOwnerName: Joi.string().trim().min(2).max(120).optional(),
  relationType: Joi.string().trim().min(2).max(120).optional(),
  gutNumber: Joi.string(),
  area: Joi.number().positive().required(),
  villageAdd: Joi.string().optional(),
  taluka: Joi.string().optional(),
  district: Joi.string().optional(),
});

export const farmerBankSchema = Joi.object({
  bankName: Joi.string().required(),
  branchName: Joi.string().required(),
  accountNo: Joi.string().required(),
  ifsc: Joi.string().required(),
  holderName: Joi.string().required(),
});

export const rejectKycSchema = Joi.object({
  reason: Joi.string().min(3).required(),
});
