import { Response } from 'express';

export const successResponse = (res: Response, data?: any, message: string = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

export const createdResponse = (
  res: Response,
  data?: any,
  message: string = 'Created successfully'
) => {
  return res.status(201).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message: string = 'Error occurred',
  statusCode: number = 400
) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};