/**
 * distributionEngine
 *
 * Evaluates DistributionRule[] for a given conversation and returns
 * the userId of the attendant to assign, or null (unassigned / queue).
 *
 * Rules are evaluated in priority order (ASC). First match wins.
 * Conditions are organized in groups. Groups are always ANDed together.
 * Within each group, conditions are connected by the group's operator (AND | OR).
 *
 * Backward-compatible: flat RuleCondition[] is treated as a single AND group.
 */

import { db } from "../db.js"

type RuleCondition = {
  field: string
  operator: string
  value: string | number | boolean
}

type RuleConditionGroup = {
  operator: "AND" | "OR"
  conditions: RuleCondition[]
}

export type AttendantResolution = {
  userId: string | null
  teamId: string | null
}

function normalizeConditions(raw: unknown): RuleConditionGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  // New format: array of groups
  if (raw[0] && typeof raw[0] === "object" && "operator" in (raw[0] as object) && "conditions" in (raw[0] as object)) {
    return raw as RuleConditionGroup[]
  }
  // Legacy format: flat array of conditions → single AND group
  return [{ operator: "AND", conditions: raw as RuleCondition[] }]
}

export async function resolveAttendant(
  conversationId: string,
  companyId: string,
  excludeUserId?: string,
): Promise<AttendantResolution> {
  // Load conversation with all data needed for condition evaluation
  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      channel: true,
      instanceId: true,
      leadValue: true,
      attendantId: true,
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

  if (!conv) return { userId: null, teamId: null }

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

  // Load team membership for current attendant (for "team" condition field)
  let attendantTeamIds: string[] = []
  if (conv.attendantId) {
    const memberships = await db.salesTeamMember.findMany({
      where: { userId: conv.attendantId },
      select: { teamId: true },
    })
    attendantTeamIds = memberships.map((m) => m.teamId)
  }

  for (const rule of rules) {
    const groups = normalizeConditions(rule.conditions)

    // Empty groups = matches everything
    const matches = groups.length === 0 || groups.every((group) => {
      if (group.conditions.length === 0) return true
      if (group.operator === "OR") {
        return group.conditions.some((cond) => evaluateCondition(cond, conv, tagNames, lastMsg, attendantTeamIds))
      }
      return group.conditions.every((cond) => evaluateCondition(cond, conv, tagNames, lastMsg, attendantTeamIds))
    })

    if (!matches) continue

    // Rule matched — update stats (fire-and-forget)
    db.distributionRule.update({
      where: { id: rule.id },
      data: { triggerCount: { increment: 1 }, lastTriggeredAt: new Date() },
    }).catch(() => {})

    // Apply action
    const result = await applyAction(rule, companyId, excludeUserId)
    if (result.userId) {
      return {
        userId: result.userId,
        teamId: rule.actionType === "TEAM" ? rule.targetTeamId : result.teamId ?? null,
      }
    }

    // Action returned null (no available member)
    if (rule.fallback === "NEXT_RULE") continue
    // Queue — if rule targets a team, return teamId so conversation lands in team queue
    if (rule.actionType === "TEAM" && rule.targetTeamId) {
      return { userId: null, teamId: rule.targetTeamId }
    }
    return { userId: null, teamId: null }
  }

  return { userId: null, teamId: null }
}

function evaluateCondition(
  cond: RuleCondition,
  conv: {
    channel: string
    instanceId: string | null
    leadValue: unknown
    attendantId: string | null
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
  attendantTeamIds: string[],
): boolean {
  const val = String(cond.value ?? "").toLowerCase()

  switch (cond.field) {
    case "channel":
      return cond.operator === "eq"
        ? conv.channel === cond.value
        : conv.channel !== cond.value

    case "instance":
      return cond.operator === "eq"
        ? (conv.instanceId ?? "") === cond.value
        : (conv.instanceId ?? "") !== cond.value

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

    case "team": {
      const inTeam = attendantTeamIds.includes(String(cond.value))
      return cond.operator === "eq" ? inTeam : !inTeam
    }

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
): Promise<{ userId: string | null; teamId: string | null }> {
  switch (rule.actionType) {
    case "SPECIFIC_USER":
      if (!rule.targetUserId || rule.targetUserId === excludeUserId) return { userId: null, teamId: null }
      return { userId: rule.targetUserId, teamId: null }

    case "EXISTING_OWNER":
      return { userId: "__EXISTING_OWNER__", teamId: null }

    case "QUEUE":
      return { userId: null, teamId: rule.targetTeamId }

    case "TEAM": {
      if (!rule.targetTeamId) return { userId: null, teamId: null }

      const members = await db.salesTeamMember.findMany({
        where: {
          teamId: rule.targetTeamId,
          ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
          user: { status: "ATIVO" },
        },
        select: { userId: true, leadCount: true },
        orderBy: rule.strategy === "LOWEST_LOAD"
          ? { leadCount: "asc" }
          : { leadCount: "asc" },
      })

      if (members.length === 0) return { userId: null, teamId: rule.targetTeamId }

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
        return { userId: withDates[0].userId, teamId: rule.targetTeamId }
      }

      // LOWEST_LOAD — already sorted
      return { userId: members[0].userId, teamId: rule.targetTeamId }
    }

    default:
      return { userId: null, teamId: null }
  }
}

/**
 * Assign a conversation to an attendant (updates attendantId + teamId + member leadCount).
 */
export async function assignConversation(
  conversationId: string,
  userId: string,
  companyId: string,
  teamId?: string | null,
): Promise<void> {
  let resolvedTeamId = teamId ?? null
  if (!resolvedTeamId) {
    const membership = await db.salesTeamMember.findFirst({
      where: { userId, team: { companyId } },
      select: { teamId: true },
    })
    resolvedTeamId = membership?.teamId ?? null
  }

  await db.conversation.update({
    where: { id: conversationId },
    data: { attendantId: userId, teamId: resolvedTeamId },
  })

  await db.salesTeamMember.updateMany({
    where: { userId, team: { companyId } },
    data: { leadCount: { increment: 1 } },
  })
}
