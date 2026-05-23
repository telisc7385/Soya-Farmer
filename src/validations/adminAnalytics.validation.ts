import Joi from "joi";

export const adminAnalyticsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  locationId: Joi.string().uuid().optional(),
});
