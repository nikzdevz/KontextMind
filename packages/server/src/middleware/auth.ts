// API Key Authentication Middleware
// Uses single API_KEY from environment (no per-project keys)

import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_KEY;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if no API_KEY is configured (development mode)
  if (!API_KEY) {
    next();
    return;
  }

  const providedKey = req.headers['x-api-key'] as string;

  if (!providedKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Provide it via X-API-Key header.',
    });
    return;
  }

  if (providedKey !== API_KEY) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key.',
    });
    return;
  }

  next();
}