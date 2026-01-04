export abstract class AppError extends Error {
  abstract statusCode: number;
  abstract errorCode: string;
  isOperational = true;

  protected constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/* -------------------- 400 -------------------- */

export class BadRequestError extends AppError {
  statusCode = 400;
  errorCode = 'BAD_REQUEST';

  constructor() {
    super('BAD_REQUEST');
  }
}

/* -------------------- 401 -------------------- */
/**
 * Authentication missing / invalid token
 */
export class UnauthorizedError extends AppError {
  statusCode = 401;
  errorCode = 'UNAUTHORIZED';

  constructor() {
    super('UNAUTHORIZED');
  }
}

/**
 * Authentication failed due to credentials
 * (wrong password, missing credential, revoked credential)
 */
export class AuthenticationFailedError extends AppError {
  statusCode = 401;
  errorCode = 'AUTHENTICATION_FAILED';

  constructor() {
    super('AUTHENTICATION_FAILED');
  }
}

/* -------------------- 403 -------------------- */

export class ForbiddenError extends AppError {
  statusCode = 403;
  errorCode = 'FORBIDDEN';

  constructor() {
    super('FORBIDDEN');
  }
}

/* -------------------- 404 -------------------- */

export class NotFoundError extends AppError {
  statusCode = 404;
  errorCode = 'NOT_FOUND';

  constructor() {
    super('NOT_FOUND');
  }
}

/* -------------------- 409 -------------------- */

export class ConflictError extends AppError {
  statusCode = 409;
  errorCode = 'CONFLICT';

  constructor() {
    super('CONFLICT');
  }
}

/* -------------------- Domain-specific -------------------- */

export class RegistrationFailedError extends AppError {
  statusCode = 400;
  errorCode = 'REGISTRATION_FAILED';

  constructor() {
    super('REGISTRATION_FAILED');
  }
}
