import { Request, Response, NextFunction } from 'express';

export class CustomError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, CustomError.prototype); 
    }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500; 
    const message = err.message || 'An unexpected error occurred.';

    console.error(`[Error ${statusCode}]: ${message}`, err.stack);
    
    res.status(statusCode).send({
        success: false,
        error: {
            status: statusCode,
            message: message,
        },
    });
};