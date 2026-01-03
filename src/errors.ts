export abstract class AppError extends Error {
  abstract statusCode: number;
  abstract errorCode: string;
  isOperational = true;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  statusCode = 400;
  errorCode = 'BAD_REQUEST';
}

export class UnauthorizedError extends AppError {
  statusCode = 401;
  errorCode = 'UNAUTHORIZED';
}

export class ForbiddenError extends AppError {
  statusCode = 403;
  errorCode = 'FORBIDDEN';
}

export class NotFoundError extends AppError {
  statusCode = 404;
  errorCode = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  statusCode = 409;
  errorCode = 'CONFLICT';
}

export class RegistrationFailedError extends AppError {
  statusCode = 400;
  errorCode = 'REGISTRATION_FAILED';

  constructor() {
    super('REGISTRATION_FAILED');
  }
}

export class AuthenticationFailedError extends AppError {
  statusCode = 401;
  errorCode = 'AUTHENTICATION_FAILED';

  constructor() {
    super('AUTHENTICATION_FAILED');
  }
}