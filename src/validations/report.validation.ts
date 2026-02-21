import Joi from "joi";

export const exportReportSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  status: Joi.string().trim().optional(), // single or comma-separated
  vendorId: Joi.string().trim().optional(),
  farmerId: Joi.string().trim().optional(),
  goniTypeId: Joi.string().trim().optional(),
  isActive: Joi.boolean().optional(),
});
