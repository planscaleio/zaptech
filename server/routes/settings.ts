import { Router, type Request, type Response } from "express"
import bcrypt from "bcryptjs"
import { db } from "../db.js"
import { encryptEmailSecret } from "../lib/email-crypto.js"
import { publicEmailAccountSelect, syncEmailAccount, testEmailAccountById } from "../lib/email-service.js"

const router = Router()

// ─── GET /settings/company ────────────────────────────────────────────────────

router.get("/company", async (req: Request, res: Response) => {
  const { companyId } = req.query as Record<string, string>
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" })

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true, name: true, slug: true, status: true,
      ownerName: true, email: true, phone: true, cnpj: true, city: true,
      transferMessageUser: true, transferMessageTeam: true,
      maxWaitMinutes: true,
      mrr: true, trialEndsAt: true, nextBilling: true,
      currentUsers: true, currentChats: true, currentAgents: true,
      plan: { select: { id: true, name: true, maxUsers: true } },
    },
  })
  if (!company) return res.status(404).json({ error: "Empresa não encontrada" })
  return res.json(company)
})

// ─── PATCH /settings/company ─────────────────────────────────────────────────

router.patch("/company", async (req: Request, res: Response) => {
  const { companyId, name, ownerName, email, phone, cnpj, city, transferMessageUser, transferMessageTeam } = req.body ?? {}
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" })

  const company = await db.company.update({
    where: { id: companyId },
    data: {
      ...(name      !== undefined ? { name }      : {}),
      ...(ownerName !== undefined ? { ownerName } : {}),
      ...(email     !== undefined ? { email }     : {}),
      ...(phone     !== undefined ? { phone }     : {}),
      ...(cnpj      !== undefined ? { cnpj }      : {}),
      ...(city      !== undefined ? { city }      : {}),
      ...(transferMessageUser !== undefined ? { transferMessageUser } : {}),
      ...(transferMessageTeam !== undefined ? { transferMessageTeam } : {}),
    },
    select: { id: true, name: true, ownerName: true, email: true, phone: true, cnpj: true, city: true, transferMessageUser: true, transferMessageTeam: true },
  })
  return res.json(company)
})

// ─── GET /settings/users ──────────────────────────────────────────────────────

router.get("/users", async (req: Request, res: Response) => {
  const { companyId } = req.query as Record<string, string>
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" })

  const users = await db.user.findMany({
    where: { companyId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, role: true, status: true,
      avatarUrl: true, lastSeen: true, createdAt: true,
    },
  })
  return res.json(users)
})

// ─── POST /settings/users — cria / convida usuário ───────────────────────────

router.post("/users", async (req: Request, res: Response) => {
  const { companyId, name, email, role } = req.body ?? {}
  if (!companyId || !name || !email) {
    return res.status(400).json({ error: "companyId, name e email são obrigatórios" })
  }

  const validRoles = ["ATENDENTE", "GESTOR", "ADMIN"]
  const safeRole = validRoles.includes(role) ? role : "ATENDENTE"

  const existing = await db.user.findFirst({ where: { email, companyId } })
  if (existing) return res.status(409).json({ error: "Já existe um usuário com esse e-mail nesta empresa" })

  const tempPassword = Math.random().toString(36).slice(2, 10)
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const user = await db.user.create({
    data: { companyId, name, email, role: safeRole, passwordHash },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  })

  return res.status(201).json({ ...user, tempPassword })
})

// ─── PATCH /settings/users/:id ───────────────────────────────────────────────

router.patch("/users/:id", async (req: Request, res: Response) => {
  const { role, status } = req.body ?? {}
  const validRoles    = ["ATENDENTE", "GESTOR", "ADMIN"]
  const validStatuses = ["ATIVO", "BLOQUEADO"]

  const user = await db.user.update({
    where: { id: req.params.id },
    data: {
      ...(role   && validRoles.includes(role)     ? { role }   : {}),
      ...(status && validStatuses.includes(status) ? { status } : {}),
    },
    select: { id: true, name: true, email: true, role: true, status: true },
  })
  return res.json(user)
})

// ─── DELETE /settings/users/:id ──────────────────────────────────────────────

router.delete("/users/:id", async (req: Request, res: Response) => {
  await db.user.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

// ─── EMAIL ACCOUNTS ──────────────────────────────────────────────────────────

router.get("/email-accounts", async (req: Request, res: Response) => {
  const { companyId } = req.query as Record<string, string>
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" })

  const accounts = await db.emailAccount.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: publicEmailAccountSelect(),
  })
  return res.json(accounts)
})

router.post("/email-accounts", async (req: Request, res: Response) => {
  const {
    companyId, displayName, email, fromName, username, password,
    imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure,
    mailbox, signature, syncEnabled,
  } = req.body ?? {}

  if (!companyId || !displayName?.trim() || !email?.trim() || !username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: "companyId, nome, e-mail, usuário e senha são obrigatórios" })
  }
  if (!imapHost?.trim() || !smtpHost?.trim()) {
    return res.status(400).json({ error: "Hosts IMAP e SMTP são obrigatórios" })
  }

  try {
    const account = await db.emailAccount.create({
      data: {
        companyId,
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        fromName: fromName?.trim() || null,
        username: username.trim(),
        passwordEnc: encryptEmailSecret(password),
        imapHost: imapHost.trim(),
        imapPort: Number(imapPort || 993),
        imapSecure: imapSecure !== false,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort || 465),
        smtpSecure: smtpSecure !== false,
        mailbox: mailbox?.trim() || "INBOX",
        signature: signature?.trim() || null,
        syncEnabled: syncEnabled !== false,
        status: "DESCONECTADO",
      },
      select: publicEmailAccountSelect(),
    })
    return res.status(201).json(account)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar conta de e-mail"
    if (message.includes("Unique constraint")) return res.status(409).json({ error: "Já existe uma conta com este e-mail" })
    return res.status(500).json({ error: message })
  }
})

router.patch("/email-accounts/:id", async (req: Request, res: Response) => {
  const {
    displayName, email, fromName, username, password,
    imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure,
    mailbox, signature, syncEnabled, status,
  } = req.body ?? {}

  const validStatuses = ["CONECTADO", "DESCONECTADO", "REVISAR", "ERRO"]
  const account = await db.emailAccount.update({
    where: { id: req.params.id },
    data: {
      ...(displayName !== undefined ? { displayName: displayName.trim() } : {}),
      ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
      ...(fromName !== undefined ? { fromName: fromName?.trim() || null } : {}),
      ...(username !== undefined ? { username: username.trim() } : {}),
      ...(password?.trim() ? { passwordEnc: encryptEmailSecret(password) } : {}),
      ...(imapHost !== undefined ? { imapHost: imapHost.trim() } : {}),
      ...(imapPort !== undefined ? { imapPort: Number(imapPort) } : {}),
      ...(imapSecure !== undefined ? { imapSecure: Boolean(imapSecure) } : {}),
      ...(smtpHost !== undefined ? { smtpHost: smtpHost.trim() } : {}),
      ...(smtpPort !== undefined ? { smtpPort: Number(smtpPort) } : {}),
      ...(smtpSecure !== undefined ? { smtpSecure: Boolean(smtpSecure) } : {}),
      ...(mailbox !== undefined ? { mailbox: mailbox?.trim() || "INBOX" } : {}),
      ...(signature !== undefined ? { signature: signature?.trim() || null } : {}),
      ...(syncEnabled !== undefined ? { syncEnabled: Boolean(syncEnabled) } : {}),
      ...(status && validStatuses.includes(status) ? { status } : {}),
    },
    select: publicEmailAccountSelect(),
  })
  return res.json(account)
})

router.delete("/email-accounts/:id", async (req: Request, res: Response) => {
  await db.emailAccount.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

router.post("/email-accounts/:id/test", async (req: Request, res: Response) => {
  try {
    const account = await testEmailAccountById(req.params.id)
    return res.json(account)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.emailAccount.update({
      where: { id: req.params.id },
      data: { status: "ERRO", lastError: message },
    }).catch(() => {})
    return res.status(422).json({ error: message })
  }
})

router.post("/email-accounts/:id/sync", async (req: Request, res: Response) => {
  try {
    const result = await syncEmailAccount(req.params.id)
    const account = await db.emailAccount.findUnique({
      where: { id: req.params.id },
      select: publicEmailAccountSelect(),
    })
    return res.json({ ...result, account })
  } catch (err) {
    return res.status(422).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── GET /settings/connectors ─────────────────────────────────────────────────

router.get("/connectors", async (req: Request, res: Response) => {
  const { companyId, type } = req.query as Record<string, string>
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" })

  const validTypes = ["CANAL", "CRM", "ENTRADA", "AGENDA", "PAGAMENTO", "OUTRO"]
  const connectors = await db.connector.findMany({
    where: {
      companyId,
      ...(type && validTypes.includes(type) ? { type: type as "CANAL" | "CRM" | "ENTRADA" | "AGENDA" | "PAGAMENTO" | "OUTRO" } : {}),
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, type: true, status: true,
      details: true, config: true, lastEventAt: true, createdAt: true,
    },
  })
  return res.json(connectors)
})

// ─── POST /settings/connectors ───────────────────────────────────────────────

router.post("/connectors", async (req: Request, res: Response) => {
  const { companyId, name, type, details, config } = req.body ?? {}
  if (!companyId || !name || !type) {
    return res.status(400).json({ error: "companyId, name e type são obrigatórios" })
  }

  const validTypes = ["CANAL", "CRM", "ENTRADA", "AGENDA", "PAGAMENTO", "OUTRO"]
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido: ${type}` })
  }

  const connector = await db.connector.create({
    data: { companyId, name, type, details, config: config ?? undefined },
    select: { id: true, name: true, type: true, status: true, details: true, config: true, createdAt: true },
  })
  return res.status(201).json(connector)
})

// ─── PATCH /settings/connectors/:id ──────────────────────────────────────────

router.patch("/connectors/:id", async (req: Request, res: Response) => {
  const { name, status, details, config } = req.body ?? {}

  const validStatuses = ["CONECTADO", "ATIVO", "REVISAR", "DESCONECTADO", "ERRO"]

  const connector = await db.connector.update({
    where: { id: req.params.id },
    data: {
      ...(name    !== undefined ? { name }    : {}),
      ...(details !== undefined ? { details } : {}),
      ...(config  !== undefined ? { config }  : {}),
      ...(status && validStatuses.includes(status) ? { status } : {}),
    },
    select: { id: true, name: true, type: true, status: true, details: true, config: true, updatedAt: true },
  })
  return res.json(connector)
})

// ─── DELETE /settings/connectors/:id ─────────────────────────────────────────

router.delete("/connectors/:id", async (req: Request, res: Response) => {
  await db.connector.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

export default router
