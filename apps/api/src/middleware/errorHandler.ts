import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Ошибка валидации", details: err.flatten() });
    return;
  }
  if (err instanceof Error) {
    console.error(err);
    const causeMessage = (err as { cause?: Error }).cause?.message;
    res.status(500).json({
      error: err.message || "Внутренняя ошибка сервера",
      ...(causeMessage ? { cause: causeMessage } : {}),
    });
    return;
  }
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
}
