import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

const SECRET = process.env.AUTH_SECRET!

export type AuthPayload = {
  sub: string
  type: "user" | "admin"
  companyId?: string
  role?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim()
  if (!token) return next()

  try {
    const payload = jwt.verify(token, SECRET) as AuthPayload
    req.user = payload
  } catch {
    // Invalid/expired token — proceed without user (routes decide visibility)
  }

  next()
}