import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[error]", err);

  if (err.name === "AppError") {
    const appErr = err as AppError;
    return res.status(appErr.statusCode).json({ error: appErr.message });
  }

  if (err.name === "ZodError") {
    return res.status(422).json({ error: "Validation error", details: err });
  }

  return res.status(500).json({ error: "Internal server error" });
}
