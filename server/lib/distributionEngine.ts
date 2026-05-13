/**
 * distributionEngine
 *
 * Evaluates DistributionRule[] for a given conversation and returns
 * the userId of the attendant to assign, or null (unassigned / queue).
 *
 * Rules are evaluated in priority order (ASC). First match wins.
 * Each rule's conditions are ANDed together.
 */

import { db } from "../db.js"

type RuleCondition = {
  field: string
  operator: string
  value: string | number | boolean
}

export async function resolveAttendant(
  conversationId: string,
  companyId: string,
  excludeUserId?: string,
): Promise<string | null> {
  // Load conversation with all data needed for condition evaluation
  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      channel: true,
      leadValue: true,
      channel: true,
      customer: {
        select: {
          id: true,
          status: true,
          stage: true,
          source: true,
          attendants: {
            select: { userId: true },
            take: 1,
            orderBy: { id: "asc" },
          },
        },
      },
      tags: { select: { tag: { select: { name: true } } } },
      messages: {
        where: { role: "CLIENTE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { text: true },
      },
    },
  })

  if (!conv) return null

  // Load active rules for this company, ordered by priority
  const rules = await db.distributionRule.findMany({
    where: { companyId, active: true },
    orderBy: { priority: "asc" },
    select: {
      id: true,
      conditions: true,
      actionType: true,
      targetTeamId: true,
      targetUserId: true,
      strategy: true,
      fallback: true,
    },
  })

  const tagNames = conv.tags.map((t) => t.tag.name.toLowerCase())
  const lastMsg  = conv.messages[0]?.text ?? ""

  for (const rule of rules) {
    const conditions = (rule.conditions as RuleCondition[]) ?? []

    // Empty conditions = matches everything
    const matches = conditions.every((cond) => evaluateCondition(cond, conv, tagNames, lastMsg))
    if (!matches) {
      if (rule.fallback === "NEXT_RULE") continue
      continue
    }

    // Rule matched — apply action
    const userId = await applyAction(rule, companyId, excludeUserId)
    if (userId) return userId

    // Action returned null (e.g. MANUAL or no available member)
    if (rule.fallback === "NEXT_RULE") continue
    return null // QUEUE
  }

  return null
}

function evaluateCondition(
  cond: RuleCondition,
  conv: {
    channel: string
    leadValue: unknown
    customer: {
      status: string
      stage: string
      source: string | null
      attendants: { userId: string | null }[]
    } | null
    tags: unknown[]
  },
  tagNames: string[],
  lastMsg: string,
): boolean {
  const val = String(cond.value ?? "").toLowerCase()

  switch (cond.field) {
    case "channel":
      return cond.operator === "eq"
        ? conv.channel === cond.value
        : conv.channel !== cond.value

    case "lead_value": {
      const lv = Number(conv.leadValue ?? 0)
      const cv = Number(cond.value)
      if (cond.operator === "gt") return lv > cv
      if (cond.operator === "lt") return lv < cv
      return lv === cv
    }

    case "lead_source":
      return cond.operator === "eq"
        ? (conv.customer?.source ?? "") === cond.value
        : (conv.customer?.source ?? "") !== cond.value

    case "customer_status":
      return cond.operator === "eq"
        ? (conv.customer?.status ?? "") === cond.value
        : (conv.customer?.status ?? "") !== cond.value

    case "customer_stage":
      return cond.operator === "eq"
        ? (conv.customer?.stage ?? "") === cond.value
        : (conv.customer?.stage ?? "") !== cond.value

    case "tag":
      return cond.operator === "contains"
        ? tagNames.includes(val)
        : !tagNames.includes(val)

    case "customer_existing": {
      const hasOwner = (conv.customer?.attendants?.length ?? 0) > 0
      return cond.value === true || cond.value === "true" ? hasOwner : !hasOwner
    }

    case "message_contains":
      return lastMsg.toLowerCase().includes(val)

    default:
      return false
  }
}

async function applyAction(
  rule: {
    actionType: string
    targetTeamId: string | null
    targetUserId: string | null
    strategy: string
  },
  companyId: string,
  excludeUserId?: string,
): Promise<string | null> {
  switch (rule.actionType) {
    case "SPECIFIC_USER":
      if (!rule.targetUserId || rule.targetUserId === excludeUserId) return null
      return rule.targetUserId

    case "EXISTING_OWNER":
      // Caller should have the conversation; engine can't resolve without the conv here
      // Return a sentinel that the caller interprets
      return "__EXISTING_OWNER__"

    case "QUEUE":
      return null

    case "TEAM": {
      if (!rule.targetTeamId) return null

      const members = await db.salesTeamMember.findMany({
        where: {
          teamId: rule.targetTeamId,
          ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
          user: { status: "ATIVO" },
        },
        select: { userId: true, leadCount: true },
        orderBy: rule.strategy === "LOWEST_LOAD"
          ? { leadCount: "asc" }
          : { leadCount: "asc" }, // round-robin fallback also picks lowest as proxy
      })

      if (members.length === 0) return null

      if (rule.strategy === "ROUND_ROBIN") {
        // Pick member who last received a lead the longest ago
        const withDates = await Promise.all(
          members.map(async (m) => {
            const lastConv = await db.conversation.findFirst({
              where: { attendantId: m.userId, companyId },
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            })
            return { userId: m.userId, lastAt: lastConv?.createdAt ?? new Date(0) }
          }),
        )
        withDates.sort((a, b) => a.lastAt.getTime() - b.lastAt.getTime())
        return withDates[0].userId
      }

      // LOWEST_LOAD — already sorted
      return members[0].userId
    }

    default:
      return null
  }
}

/**
 * Assign a conversation to an attendant (updates attendantId + member leadCount).
 */
export async function assignConversation(
  conversationId: string,
  userId: string,
  companyId: string,
): Promise<void> {
  await db.conversation.update({
    where: { id: conversationId },
    data: { attendantId: userId },
  })

  // Increment leadCount on the team member(s) for this user+company
  await db.salesTeamMember.updateMany({
    where: { userId, team: { companyId } },
    data: { leadCount: { increment: 1 } },
  })
}
