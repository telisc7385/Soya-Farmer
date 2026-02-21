import { Request, Response, NextFunction } from "express";
import { AppError } from "../core/appError";
import Joi from "joi";

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      return next(new AppError(messages, 400));
    }

    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      return next(new AppError(messages, 400));
    }

    next();
  };
};
