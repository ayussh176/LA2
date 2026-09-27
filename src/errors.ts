export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode: number = 400, errorCode: string = "BAD_REQUEST") {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnparseableNoticeError extends AppError {
  constructor(message: string = "Could not extract required railway delay information.") {
    super(message, 400, "UNPARSEABLE_NOTICE");
  }
}

export class InvalidInputError extends AppError {
  constructor(message: string) {
    super(message, 422, "INVALID_INPUT");
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string = "Payload exceeds maximum allowed size.") {
    super(message, 413, "PAYLOAD_TOO_LARGE");
  }
}
