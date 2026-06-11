/**
 * Wraps an async route handler to catch errors and forward to Express error middleware.
 * Eliminates the need for manual try/catch in every route handler.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => next(err instanceof Error ? err : new Error(String(err))));
  };
}
