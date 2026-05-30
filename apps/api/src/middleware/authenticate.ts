import type { NextFunction, Request, Response } from "express";
import { jwtService, type JwtPayload } from "../services/auth/jwt.js";
import { db } from "../db/index.js";
import { sysUserTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  let token: string | undefined;

  if (header?.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    res.status(401).json({ error: "Требуется авторизация" });
    return;
  }

  const payload = await jwtService.verify(token, "access");
  if (!payload) {
    res.status(401).json({ error: "Недействительный токен" });
    return;
  }

  // Verify user is still active
  const [user] = await db
    .select({ isActive: sysUserTable.isActive })
    .from(sysUserTable)
    .where(eq(sysUserTable.id, payload.userId))
    .limit(1);

  if (!user?.isActive) {
    res.status(403).json({ error: "Пользователь заблокирован" });
    return;
  }

  req.user = payload;
  next();
}
