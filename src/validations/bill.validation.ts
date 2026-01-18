import Joi from "joi";

export const createBillSchema = Joi.object({
  farmerId: Joi.string().uuid().required(),
  millId: Joi.string().uuid().required(),
  vehicleId: Joi.string().uuid().required(),
  billDate: Joi.date().required(),
});

export const addBillItemSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().valid("KG", "QTL").required(),
  rate: Joi.number().positive().required(),
  bagCount: Joi.number().integer().min(0).required(),
});
