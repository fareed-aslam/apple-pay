import { Request, Response, NextFunction } from 'express';
import { CustomError } from './errors';

// Validation for starting the trial
export const validateSubscriptionData = (req: Request, res: Response, next: NextFunction) => {
    const { paymentMethodId, email } = req.body;

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
        return next(new CustomError(400, 'Invalid or missing paymentMethodId in request body.'));
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return next(new CustomError(400, 'Valid email is required.'));
    }

    next();
};