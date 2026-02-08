import Joi from "joi";

export const transferStockToAdminSchema = Joi.object({
  stockId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
});
