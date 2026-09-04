import Joi from "joi";

export const addVillageSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required().messages({
    "string.empty": "Village name is required",
    "any.required": "Village name is required",
  }),
});
