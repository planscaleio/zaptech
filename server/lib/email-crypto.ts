import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"

function secretKey() {
  const secret = process.env.EMAIL_CREDENTIAL_SECRET || process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("EMAIL_CREDENTIAL_SECRET ou AUTH_SECRET precisa estar configurado")
  }
  return crypto.createHash("sha256").update(secret).digest()
}

export function encryptEmailSecret(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(":")
}

export function decryptEmailSecret(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(":")
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Credencial criptografada inválida")
  const decipher = crypto.createDecipheriv(ALGORITHM, secretKey(), Buffer.from(ivRaw, "base64"))
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}
