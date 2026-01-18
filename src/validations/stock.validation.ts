import Joi from "joi";

export const addStockSchema = Joi.object({
  farmerId: Joi.string().uuid().required(),
  productId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
});

export const adjustStockSchema = Joi.object({
  stockId: Joi.string().uuid().required(),
  quantity: Joi.number().required(), // can be + or -
  reason: Joi.string().optional(),
});
