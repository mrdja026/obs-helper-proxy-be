class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

class OBSConnectionError extends AppError {
    constructor(message) {
        super(message, 503);
        this.name = 'OBSConnectionError';
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

module.exports = {
    AppError,
    OBSConnectionError,
    ValidationError,
    NotFoundError
}; 