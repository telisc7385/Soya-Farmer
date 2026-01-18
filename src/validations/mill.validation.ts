import Joi from "joi";

export const millSchema = Joi.object({
  name: Joi.string().min(3).required(),
  address: Joi.string().allow("", null),
});
