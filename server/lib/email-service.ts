import { ImapFlow } from "imapflow"
import nodemailer from "nodemailer"
import { simpleParser } from "mailparser"
import { db } from "../db.js"
import { decryptEmailSecret } from "./email-crypto.js"
import { resolveAttendant, assignConversation } from "./distributionEngine.js"

type EmailAccountRecord = {
  id: string
  companyId: string
  displayName: string
  email: string
  fromName: string | null
  username: string
  passwordEnc: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  mailbox: string
  signature: string | null
  lastUid: number
}

const MAX_MESSAGES_PER_SYNC = 25

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function textFromParsed(parsed: Awaited<ReturnType<typeof simpleParser>>) {
  return (parsed.text || (typeof parsed.html === "string" ? htmlToText(parsed.html) : "") || "(E-mail sem corpo)").trim()
}

export function publicEmailAccountSelect() {
  return {
    id: true,
    companyId: true,
    displayName: true,
    email: true,
    fromName: true,
    username: true,
    imapHost: true,
    imapPort: true,
    imapSecure: true,
    smtpHost: true,
    smtpPort: true,
    smtpSecure: true,
    mailbox: true,
    signature: true,
    status: true,
    syncEnabled: true,
    lastSyncAt: true,
    lastUid: true,
    lastError: true,
    createdAt: true,
    updatedAt: true,
  } as const
}

async function getAccount(id: string): Promise<EmailAccountRecord | null> {
  return db.emailAccount.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      displayName: true,
      email: true,
      fromName: true,
      username: true,
      passwordEnc: true,
      imapHost: true,
      imapPort: true,
      imapSecure: true,
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      mailbox: true,
      signature: true,
      lastUid: true,
    },
  })
}

function buildImapClient(account: EmailAccountRecord) {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: {
      user: account.username,
      pass: decryptEmailSecret(account.passwordEnc),
    },
    logger: false,
  })
}

function buildTransport(account: EmailAccountRecord) {
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: {
      user: account.username,
      pass: decryptEmailSecret(account.passwordEnc),
    },
  })
}

export async function testEmailAccountConnections(account: EmailAccountRecord) {
  const imap = buildImapClient(account)
  try {
    await imap.connect()
    await imap.mailboxOpen(account.mailbox)
  } finally {
    await imap.logout().catch(() => {})
  }

  const transport = buildTransport(account)
  await transport.verify()
}

export async function testEmailAccountById(id: string) {
  const account = await getAccount(id)
  if (!account) throw new Error("Conta de e-mail não encontrada")
  await testEmailAccountConnections(account)
  return db.emailAccount.update({
    where: { id },
    data: { status: "CONECTADO", lastError: null },
    select: publicEmailAccountSelect(),
  })
}

export async function sendEmailReply({
  emailAccountId,
  to,
  body,
  subject,
}: {
  emailAccountId: string
  to: string
  body: string
  subject?: string | null
}) {
  const account = await getAccount(emailAccountId)
  if (!account) throw new Error("Conta de e-mail não encontrada")

  const signature = account.signature?.trim()
  const text = signature ? `${body.trim()}\n\n${signature}` : body.trim()
  const transport = buildTransport(account)
  const from = account.fromName ? `"${account.fromName}" <${account.email}>` : account.email

  await transport.sendMail({
    from,
    to,
    subject: subject?.trim() || "Re: Atendimento",
    text,
  })
}

async function importEmailMessage(account: EmailAccountRecord, msg: { uid: number; source?: Buffer; envelope?: { messageId?: string; subject?: string; from?: { name?: string; address?: string }[] }; internalDate?: Date | string }) {
  const existing = await db.emailImportedMessage.findUnique({
    where: { emailAccountId_uid: { emailAccountId: account.id, uid: msg.uid } },
    select: { id: true },
  })
  if (existing || !msg.source) return { imported: false, uid: msg.uid }

  const parsed = await simpleParser(msg.source)
  const from = parsed.from?.value?.[0]
  const fromAddress = from?.address || msg.envelope?.from?.[0]?.address
  if (!fromAddress) return { imported: false, uid: msg.uid }

  const fromName = from?.name || msg.envelope?.from?.[0]?.name || fromAddress
  const internetMessageId = parsed.messageId || msg.envelope?.messageId || null
  const subject = parsed.subject || msg.envelope?.subject || "(sem assunto)"
  const receivedAt = parsed.date || (msg.internalDate ? new Date(msg.internalDate) : new Date())
  const text = textFromParsed(parsed)

  if (internetMessageId) {
    const existingMessageId = await db.emailImportedMessage.findUnique({
      where: { emailAccountId_internetMessageId: { emailAccountId: account.id, internetMessageId } },
      select: { id: true },
    })
    if (existingMessageId) return { imported: false, uid: msg.uid }
  }

  const result = await db.$transaction(async (tx) => {
    const existingCustomer = await tx.customer.findFirst({
      where: { companyId: account.companyId, email: fromAddress },
      select: { id: true },
    })

    const customer = existingCustomer
      ? await tx.customer.update({
          where: { id: existingCustomer.id },
          data: { name: fromName, lastContactAt: receivedAt },
        })
      : await tx.customer.create({
          data: {
            companyId: account.companyId,
            name: fromName,
            email: fromAddress,
            status: "EM_ANALISE",
            stage: "QUALIFICACAO",
            source: "EMAIL",
            lastContactAt: receivedAt,
          },
        })

    const existingConversation = await tx.conversation.findFirst({
      where: {
        companyId: account.companyId,
        customerId: customer.id,
        channel: "EMAIL",
        status: { notIn: ["ENCERRADO", "ARQUIVADO", "PARA_EXCLUIR"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    const preview = `${subject}: ${text}`.slice(0, 240)
    const conversation = existingConversation
      ? await tx.conversation.update({
          where: { id: existingConversation.id },
          data: {
            emailAccountId: account.id,
            preview,
            lastMessageAt: receivedAt,
            status: "EM_ANALISE",
          },
        })
      : await tx.conversation.create({
          data: {
            companyId: account.companyId,
            customerId: customer.id,
            emailAccountId: account.id,
            channel: "EMAIL",
            status: "EM_ANALISE",
            preview,
            lastMessageAt: receivedAt,
          },
        })

    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        authorName: fromName,
        role: "CLIENTE",
        text,
        isAiGenerated: false,
        align: "left",
        createdAt: receivedAt,
      },
      select: { id: true },
    })

    await tx.emailImportedMessage.create({
      data: {
        emailAccountId: account.id,
        uid: msg.uid,
        internetMessageId,
        conversationId: conversation.id,
        messageId: message.id,
        subject,
        fromAddress,
        receivedAt,
      },
    })

    return { conversationId: conversation.id, isNew: !existingConversation }
  })

  if (result.isNew) {
    const targetUserId = await resolveAttendant(result.conversationId, account.companyId)
    if (targetUserId && targetUserId !== "__EXISTING_OWNER__") {
      await assignConversation(result.conversationId, targetUserId, account.companyId)
    }
  }

  return { imported: true, uid: msg.uid }
}

export async function syncEmailAccount(id: string) {
  const account = await getAccount(id)
  if (!account) throw new Error("Conta de e-mail não encontrada")

  const client = buildImapClient(account)
  let imported = 0
  let maxUid = account.lastUid

  try {
    await client.connect()
    await client.mailboxOpen(account.mailbox)

    const range = account.lastUid > 0 ? `${account.lastUid + 1}:*` : "1:*"
    let seen = 0

    for await (const msg of client.fetch(range, { uid: true, envelope: true, internalDate: true, source: true }, { uid: true })) {
      seen++
      const result = await importEmailMessage(account, msg)
      if (result.imported) imported++
      maxUid = Math.max(maxUid, result.uid)
      if (seen >= MAX_MESSAGES_PER_SYNC) break
    }

    await db.emailAccount.update({
      where: { id: account.id },
      data: {
        status: "CONECTADO",
        lastSyncAt: new Date(),
        lastUid: maxUid,
        lastError: null,
      },
    })

    return { imported, lastUid: maxUid }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.emailAccount.update({
      where: { id: account.id },
      data: { status: "ERRO", lastError: message, lastSyncAt: new Date() },
    }).catch(() => {})
    throw err
  } finally {
    await client.logout().catch(() => {})
  }
}
