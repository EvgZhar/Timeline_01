import type { NextFunction, Request, Response } from "express";
import { jwtService, type JwtPayload } from "../services/auth/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Требуется авторизация" });
    return;
  }

  const token = header.slice(7);
  const payload = jwtService.verify(token);
  if (!payload) {
    res.status(401).json({ error: "Недействительный токен" });
    return;
  }

  req.user = payload;
  next();
}
