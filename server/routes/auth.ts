import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { db } from "../db.js"

const router = Router()

const TTL = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 604800)
const SECRET = process.env.AUTH_SECRET!

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? ""
}

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: "email e password são obrigatórios" })
  }

  const ip = getClientIp(req)
  const userAgent = req.headers["user-agent"] ?? ""

  // Try regular User first, then AdminUser
  const user = await db.user.findFirst({ where: { email } })
  const adminUser = !user ? await db.adminUser.findFirst({ where: { email } }) : null

  const actor = user ?? adminUser

  if (!actor) {
    await db.authLog.create({
      data: { email, result: "USER_NOT_FOUND", ip, userAgent },
    })
    return res.status(401).json({ error: "Credenciais inválidas" })
  }

  if (!actor.passwordHash) {
    await db.authLog.create({
      data: {
        email,
        result: "WRONG_PASSWORD",
        actorType: user ? "USER" : "ADMIN_USER",
        userId: user?.id,
        adminUserId: adminUser?.id,
        companyId: user ? (user as typeof user).companyId : null,
        ip,
        userAgent,
      },
    })
    return res.status(401).json({ error: "Credenciais inválidas" })
  }

  const valid = await bcrypt.compare(password, actor.passwordHash)

  if (!valid) {
    await db.authLog.create({
      data: {
        email,
        result: "WRONG_PASSWORD",
        actorType: user ? "USER" : "ADMIN_USER",
        userId: user?.id,
        adminUserId: adminUser?.id,
        companyId: user ? (user as typeof user).companyId : null,
        ip,
        userAgent,
      },
    })
    return res.status(401).json({ error: "Credenciais inválidas" })
  }

  // Issue JWT
  const expiresAt = new Date(Date.now() + TTL * 1000)
  const payload = {
    sub: actor.id,
    type: user ? "user" : "admin",
    ...(user && { companyId: (user as typeof user).companyId, role: user.role }),
    ...(adminUser && { role: adminUser.role }),
  }

  const token = jwt.sign(payload, SECRET, { expiresIn: TTL })

  // Persist session
  await db.session.create({
    data: {
      token,
      expiresAt,
      userId: user?.id,
      adminUserId: adminUser?.id,
      ip,
      userAgent,
    },
  })

  // Log success
  await db.authLog.create({
    data: {
      email,
      result: "SUCCESS",
      actorType: user ? "USER" : "ADMIN_USER",
      userId: user?.id,
      adminUserId: adminUser?.id,
      companyId: user ? (user as typeof user).companyId : null,
      ip,
      userAgent,
    },
  })

  return res.json({
    token,
    expiresAt,
    user: {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
      type: user ? "user" : "admin",
      ...(user && { companyId: (user as typeof user).companyId }),
    },
  })
})

router.post("/logout", async (req: Request, res: Response) => {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim()
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {})
  }
  return res.json({ ok: true })
})

export default router
