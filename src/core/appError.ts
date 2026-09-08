export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: string[];

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: string[],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}