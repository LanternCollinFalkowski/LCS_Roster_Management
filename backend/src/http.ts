import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

/** Wrap an async route handler so thrown errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** A typed application error with an HTTP status code. */
export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (msg = "Not found") => new HttpError(404, msg);
export const badRequest = (msg = "Bad request", details?: unknown) =>
  new HttpError(400, msg, details);
export const unauthorized = (msg = "Unauthorized") => new HttpError(401, msg);
export const forbidden = (msg = "Forbidden") => new HttpError(403, msg);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Short id shared by this request's log lines and its error response. */
      id?: string;
    }
  }
}

/**
 * Give every request a short id, echo it on the response, and log the ones that
 * fail.
 *
 * Diagnosing a production error previously meant asking the person what they had
 * clicked. Now the message they see carries an id that appears verbatim in the
 * server log next to the method, path, actor and stack.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  // Honour an upstream id when a proxy supplies one, so a single request keeps
  // one identity across hops.
  const upstream = req.headers["x-request-id"];
  req.id = (typeof upstream === "string" && upstream.slice(0, 64)) || crypto.randomUUID().slice(0, 8);
  res.setHeader("X-Request-Id", req.id);
  next();
}

/** Central error handler. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const id = req.id ?? "-";

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
      requestId: id,
    });
  }
  if (err instanceof HttpError) {
    // Expected refusals (400/401/403/404) are part of normal operation and are
    // not logged as failures — only server faults are.
    if (err.status >= 500) {
      console.error(
        `[${id}] ${req.method} ${req.originalUrl} -> ${err.status} (user ${req.user?.email ?? "anonymous"})`,
        err
      );
    }
    return res.status(err.status).json({ error: err.message, details: err.details, requestId: id });
  }

  console.error(
    `[${id}] ${req.method} ${req.originalUrl} -> 500 (user ${req.user?.email ?? "anonymous"})`,
    err
  );
  // The id is the one piece of the internal failure it is safe to hand over, and
  // it is what turns "it broke" into something searchable.
  return res.status(500).json({
    error: "Something went wrong on our end. Quote this reference if you report it.",
    requestId: id,
  });
}
