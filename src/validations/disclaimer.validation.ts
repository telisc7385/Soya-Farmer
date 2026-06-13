import Joi from "joi";

export const updateDisclaimerSchema = Joi.object({
  text: Joi.string().allow("").required(),
});
