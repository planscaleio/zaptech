import bcrypt from "bcryptjs"
import type { PrismaClient } from "@prisma/client"

type Db = PrismaClient

const DEMO_COMPANY_SLUG = "zaptech-demo"
const DEMO_DOMAIN = "zaptech.com.br"
const DEMO_PASSWORD = "Demo@123"

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function assembleSystemPrompt(config: Record<string, string>) {
  return [
    ["OBJETIVO", config.objetivo],
    ["CONTEXTO", config.contexto],
    ["INSTRUCOES", config.instrucoesDiretas],
    ["FORMATO DE RESPOSTA", config.formatoResposta],
    ["TOM DE VOZ", config.tomDeVoz],
    ["RESTRICOES", config.restricoes],
  ]
    .filter(([, value]) => value?.trim())
    .map(([title, value]) => `# ${title}\n${value.trim()}`)
    .join("\n\n")
}

async function cleanupDemoCompany(db: Db, companyId: string) {
  const statements = [
    `DELETE FROM "SupportTicketActivity" WHERE "ticketId" IN (SELECT id FROM "SupportTicket" WHERE "companyId" = $1)`,
    `DELETE FROM "SupportTicket" WHERE "companyId" = $1`,
    `DELETE FROM "AIAuditFinding" WHERE "auditId" IN (SELECT id FROM "AIAudit" WHERE "companyId" = $1)`,
    `DELETE FROM "AIAudit" WHERE "companyId" = $1`,
    `DELETE FROM "QuoteEvent" WHERE "quoteId" IN (SELECT id FROM "Quote" WHERE "companyId" = $1)`,
    `DELETE FROM "QuoteItem" WHERE "quoteId" IN (SELECT id FROM "Quote" WHERE "companyId" = $1)`,
    `DELETE FROM "Quote" WHERE "companyId" = $1`,
    `DELETE FROM "OutboundMessage" WHERE "companyId" = $1`,
    `DELETE FROM "Message" WHERE "conversationId" IN (SELECT id FROM "Conversation" WHERE "companyId" = $1)`,
    `DELETE FROM "ConversationTagLink" WHERE "conversationId" IN (SELECT id FROM "Conversation" WHERE "companyId" = $1)`,
    `DELETE FROM "Conversation" WHERE "companyId" = $1`,
    `DELETE FROM "InboundMessage" WHERE "companyId" = $1`,
    `DELETE FROM "KanbanActivity" WHERE "cardId" IN (
      SELECT kc.id FROM "KanbanCard" kc
      JOIN "KanbanColumn" col ON col.id = kc."columnId"
      JOIN "KanbanBoard" board ON board.id = col."boardId"
      WHERE board."companyId" = $1
    )`,
    `DELETE FROM "KanbanCard" WHERE "columnId" IN (
      SELECT col.id FROM "KanbanColumn" col
      JOIN "KanbanBoard" board ON board.id = col."boardId"
      WHERE board."companyId" = $1
    )`,
    `DELETE FROM "KanbanColumn" WHERE "boardId" IN (SELECT id FROM "KanbanBoard" WHERE "companyId" = $1)`,
    `DELETE FROM "KanbanBoard" WHERE "companyId" = $1`,
    `DELETE FROM "FlowBranch" WHERE "nodeId" IN (
      SELECT node.id FROM "FlowNode" node
      JOIN "Workflow" workflow ON workflow.id = node."workflowId"
      WHERE workflow."companyId" = $1
    ) OR "targetNodeId" IN (
      SELECT node.id FROM "FlowNode" node
      JOIN "Workflow" workflow ON workflow.id = node."workflowId"
      WHERE workflow."companyId" = $1
    )`,
    `DELETE FROM "FlowNode" WHERE "workflowId" IN (SELECT id FROM "Workflow" WHERE "companyId" = $1)`,
    `DELETE FROM "Workflow" WHERE "companyId" = $1`,
    `DELETE FROM "DynamicQrClick" WHERE "companyId" = $1`,
    `DELETE FROM "DynamicQrLink" WHERE "companyId" = $1`,
    `DELETE FROM "Broadcast" WHERE "companyId" = $1`,
    `DELETE FROM "Campaign" WHERE "companyId" = $1`,
    `DELETE FROM "SegmentCustomer" WHERE "segmentId" IN (SELECT id FROM "Segment" WHERE "companyId" = $1)`,
    `DELETE FROM "Segment" WHERE "companyId" = $1`,
    `DELETE FROM "CustomerAIFinding" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE "companyId" = $1)`,
    `DELETE FROM "CustomerChatHistory" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE "companyId" = $1)`,
    `DELETE FROM "CustomerAttendant" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE "companyId" = $1)`,
    `DELETE FROM "CustomerProduct" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE "companyId" = $1)`,
    `DELETE FROM "CustomerTagLink" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE "companyId" = $1)`,
    `DELETE FROM "Customer" WHERE "companyId" = $1`,
    `DELETE FROM "CatalogProduct" WHERE "companyId" = $1`,
    `DELETE FROM "ProductCategory" WHERE "companyId" = $1`,
    `DELETE FROM "SalesTeamChannel" WHERE "teamId" IN (SELECT id FROM "SalesTeam" WHERE "companyId" = $1)`,
    `DELETE FROM "SalesTeamMember" WHERE "teamId" IN (SELECT id FROM "SalesTeam" WHERE "companyId" = $1)`,
    `DELETE FROM "DistributionRule" WHERE "companyId" = $1`,
    `DELETE FROM "SalesTeam" WHERE "companyId" = $1`,
    `UPDATE "KnowledgeArticle" SET "publishedVersionId" = NULL, "draftVersionId" = NULL WHERE "companyId" = $1`,
    `DELETE FROM "KnowledgeArticleVersion" WHERE "articleId" IN (SELECT id FROM "KnowledgeArticle" WHERE "companyId" = $1)`,
    `DELETE FROM "KnowledgeArticle" WHERE "companyId" = $1`,
    `DELETE FROM "InvoiceLineItem" WHERE "invoiceId" IN (SELECT id FROM "Invoice" WHERE "companyId" = $1)`,
    `DELETE FROM "Invoice" WHERE "companyId" = $1`,
    `DELETE FROM "Metric" WHERE "companyId" = $1`,
    `DELETE FROM "Connector" WHERE "companyId" = $1`,
    `DELETE FROM "CompanyWhatsAppRouting" WHERE "companyId" = $1`,
    `DELETE FROM "Agent" WHERE "companyId" = $1`,
    `DELETE FROM "BusinessAccount" WHERE "companyId" = $1`,
    `DELETE FROM "AuthLog" WHERE "companyId" = $1 OR "userId" IN (SELECT id FROM "User" WHERE "companyId" = $1)`,
    `DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE "companyId" = $1)`,
    `DELETE FROM "User" WHERE "companyId" = $1`,
    `DELETE FROM "Tag" WHERE "companyId" = $1`,
  ]

  for (const statement of statements) {
    await db.$executeRawUnsafe(statement, companyId)
  }
}

export async function seedDemo(db: Db) {
  const plan = await db.plan.findUnique({ where: { slug: "scale" } })
  if (!plan) throw new Error("Plano Scale nao encontrado. Rode o seed de planos antes da demo.")

  const existingCompany = await db.company.findUnique({
    where: { slug: DEMO_COMPANY_SLUG },
    select: { id: true },
  })
  if (existingCompany) {
    await cleanupDemoCompany(db, existingCompany.id)
    await db.company.delete({ where: { id: existingCompany.id } })
  }

  const company = await db.company.create({
    data: {
      name: "ZapTech Solutions",
      slug: DEMO_COMPANY_SLUG,
      status: "ATIVA",
      planId: plan.id,
      ownerName: "Marina Costa",
      email: `contato@${DEMO_DOMAIN}`,
      phone: "+55 11 4002-2026",
      cnpj: "42.715.920/0001-08",
      city: "Sao Paulo",
      mrr: "1990.00",
      nextBilling: daysFromNow(18),
      currentUsers: 6,
      currentChats: 428,
      currentAgents: 4,
    },
  })

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const userSeeds = [
    ["Marina Costa", "marina", "OWNER", 1],
    ["Rafael Nogueira", "rafael", "ADMIN", 4],
    ["Camila Rocha", "camila", "GESTOR", 2],
    ["Bruno Almeida", "bruno", "ATENDENTE", 0.5],
    ["Livia Martins", "livia", "ATENDENTE", 6],
    ["Paulo Azevedo", "paulo", "ATENDENTE", 20],
  ] as const

  const users = new Map<string, Awaited<ReturnType<Db["user"]["create"]>>>()
  for (const [name, mailbox, role, lastSeenHours] of userSeeds) {
    const user = await db.user.create({
      data: {
        companyId: company.id,
        name,
        email: `${mailbox}@${DEMO_DOMAIN}`,
        role,
        status: "ATIVO",
        lastSeen: hoursAgo(lastSeenHours),
        passwordHash,
      },
    })
    users.set(mailbox, user)
  }

  const adminHash = await bcrypt.hash("ZapTechAdmin@123", 12)
  await db.adminUser.upsert({
    where: { email: `admin@${DEMO_DOMAIN}` },
    update: { name: "Admin Demo ZapTech", role: "SUPER_ADMIN", passwordHash: adminHash, lastSeen: hoursAgo(3) },
    create: {
      name: "Admin Demo ZapTech",
      email: `admin@${DEMO_DOMAIN}`,
      role: "SUPER_ADMIN",
      passwordHash: adminHash,
      lastSeen: hoursAgo(3),
    },
  })

  const tags = new Map<string, string>()
  for (const [name, color] of [
    ["alta-intencao", "#16a34a"],
    ["enterprise", "#7c3aed"],
    ["whatsapp", "#0ea5e9"],
    ["suporte", "#f97316"],
    ["upsell", "#db2777"],
    ["risco-churn", "#dc2626"],
    ["demo-agendada", "#2563eb"],
    ["financeiro", "#ca8a04"],
  ] as const) {
    const tag = await db.tag.create({ data: { companyId: company.id, name, color } })
    tags.set(name, tag.id)
  }

  const connectors = [
    ["WhatsApp Oficial", "CANAL", "CONECTADO", "Numero principal conectado via Evolution API"],
    ["Instagram Direct", "CANAL", "ATIVO", "Entrada social para campanhas e remarketing"],
    ["HubSpot CRM", "CRM", "CONECTADO", "Sincronizacao bidirecional de contatos e negocios"],
    ["Google Calendar", "AGENDA", "REVISAR", "Agenda comercial aguardando renovacao de permissao"],
    ["Asaas Pix", "PAGAMENTO", "ATIVO", "Cobrancas e segunda via automatizadas"],
  ] as const
  for (const [name, type, status, details] of connectors) {
    await db.connector.create({
      data: {
        companyId: company.id,
        name,
        type,
        status,
        details,
        lastEventAt: hoursAgo(Math.floor(Math.random() * 24) + 1),
        config: { ambiente: "demo", origem: "seed-demo" },
      },
    })
  }

  await db.companyWhatsAppRouting.create({
    data: {
      companyId: company.id,
      activePhone: "+551140022026",
      backupPhones: ["+551140022027", "+551140022028"],
      defaultMessage: "Ola! Sou o assistente da ZapTech. Me conta em que posso ajudar hoje?",
      enabled: true,
    },
  })

  const agentSeeds = [
    {
      key: "sdr",
      name: "IA SDR Inbound",
      iconName: "Target",
      status: "ONLINE" as const,
      temperatura: 0.32,
      description: "Qualifica leads de WhatsApp, site e campanhas.",
      config: {
        objetivo: "Qualificar leads inbound usando BANT e encaminhar oportunidades prontas para o time comercial.",
        contexto: "A ZapTech vende automacoes de atendimento e CRM para PMEs com times comerciais entre 3 e 80 pessoas.",
        instrucoesDiretas: "Pergunte sobre volume de atendimentos, tamanho do time, ferramenta atual, urgencia e decisor envolvido.",
        formatoResposta: "Mensagens curtas, com no maximo duas perguntas por resposta.",
        tomDeVoz: "Consultivo, claro e confiante.",
        restricoes: "Nao prometa desconto sem aprovacao do gestor e nao cite concorrentes de forma negativa.",
      },
    },
    {
      key: "suporte",
      name: "IA Suporte N1",
      iconName: "Headphones",
      status: "ONLINE" as const,
      temperatura: 0.2,
      description: "Resolve duvidas operacionais e abre ticket quando necessario.",
      config: {
        objetivo: "Resolver duvidas de configuracao, canais, funis, usuarios e primeira triagem de incidentes.",
        contexto: "Clientes usam WhatsApp, Instagram, e-mail, funis comerciais, IA e orcamentos pela plataforma.",
        instrucoesDiretas: "Confirme o problema, peca evidencia quando necessario e escale para N2 apos tres tentativas.",
        formatoResposta: "Passo a passo objetivo.",
        tomDeVoz: "Tecnico, paciente e preciso.",
        restricoes: "Nunca solicite senha, token ou codigo de autenticacao em texto aberto.",
      },
    },
    {
      key: "cs",
      name: "IA Sucesso do Cliente",
      iconName: "HeartHandshake",
      status: "BUSY" as const,
      temperatura: 0.38,
      description: "Acompanha onboarding, retencao e oportunidades de expansao.",
      config: {
        objetivo: "Aumentar ativacao, reduzir churn e identificar upsell em contas com alto uso.",
        contexto: "Onboarding dura 30 dias e sucesso e medido por canais conectados, funil ativo e respostas dentro do SLA.",
        instrucoesDiretas: "Priorize contas com baixo uso, mensagens sem resposta e sinais de insatisfacao.",
        formatoResposta: "Prosa objetiva com proximos passos.",
        tomDeVoz: "Proximo, calmo e orientado a resultado.",
        restricoes: "Nao ofereca upgrade antes de validar satisfacao e valor percebido.",
      },
    },
    {
      key: "financeiro",
      name: "IA Financeiro",
      iconName: "ReceiptText",
      status: "OFFLINE" as const,
      temperatura: 0.25,
      description: "Segunda via, lembretes de vencimento e recuperacao amigavel.",
      config: {
        objetivo: "Ajudar clientes com faturas, segunda via e regularizacao de pendencias.",
        contexto: "A abordagem financeira deve ser discreta, cordial e sempre dentro do horario comercial.",
        instrucoesDiretas: "Ofereca Pix, boleto ou encaminhamento ao financeiro humano conforme a situacao.",
        formatoResposta: "Texto curto e formal.",
        tomDeVoz: "Profissional e respeitoso.",
        restricoes: "Nao exponha valores sensiveis antes de confirmar identidade do contato.",
      },
    },
  ]

  const agents = new Map<string, Awaited<ReturnType<Db["agent"]["create"]>>>()
  for (const agent of agentSeeds) {
    const created = await db.agent.create({
      data: {
        companyId: company.id,
        name: agent.name,
        iconName: agent.iconName,
        status: agent.status,
        description: agent.description,
        modelId: "gpt-4.1-mini",
        temperatura: agent.temperatura,
        config: agent.config,
        instructions: assembleSystemPrompt(agent.config),
      },
    })
    agents.set(agent.key, created)
  }

  const teamComercial = await db.salesTeam.create({
    data: {
      companyId: company.id,
      managerId: users.get("camila")!.id,
      name: "Comercial Inbound",
      targetValue: "180000.00",
      pipelineValue: "286400.00",
      conversionRate: "31.50",
      channels: { create: [{ channel: "WHATSAPP" }, { channel: "SITE" }, { channel: "INSTAGRAM" }] },
      members: {
        create: [
          { userId: users.get("bruno")!.id, role: "Closer", leadCount: 18, revenueValue: "84200.00" },
          { userId: users.get("livia")!.id, role: "SDR", leadCount: 27, revenueValue: "52300.00" },
          { userId: users.get("rafael")!.id, role: "Especialista enterprise", leadCount: 9, revenueValue: "149900.00" },
        ],
      },
    },
  })
  const teamSuporte = await db.salesTeam.create({
    data: {
      companyId: company.id,
      managerId: users.get("rafael")!.id,
      name: "Suporte e CS",
      targetValue: "65000.00",
      pipelineValue: "88400.00",
      conversionRate: "44.00",
      channels: { create: [{ channel: "WHATSAPP" }, { channel: "EMAIL" }, { channel: "TELEFONE" }] },
      members: {
        create: [
          { userId: users.get("paulo")!.id, role: "Suporte N1", leadCount: 14, revenueValue: "18300.00" },
          { userId: users.get("camila")!.id, role: "CS Manager", leadCount: 11, revenueValue: "70100.00" },
        ],
      },
    },
  })

  await db.distributionRule.createMany({
    data: [
      {
        companyId: company.id,
        name: "Leads enterprise para especialista",
        priority: 1,
        conditions: [{ field: "leadValue", operator: "gte", value: 25000 }, { field: "channel", operator: "in", value: ["WHATSAPP", "SITE"] }],
        actionType: "SPECIFIC_USER",
        targetUserId: users.get("rafael")!.id,
        strategy: "MANUAL",
        fallback: "QUEUE",
      },
      {
        companyId: company.id,
        name: "Inbound comercial round-robin",
        priority: 2,
        conditions: [{ field: "source", operator: "in", value: ["WHATSAPP", "INSTAGRAM", "SITE"] }],
        actionType: "TEAM",
        targetTeamId: teamComercial.id,
        strategy: "ROUND_ROBIN",
        fallback: "NEXT_RULE",
      },
      {
        companyId: company.id,
        name: "Suporte e financeiro para CS",
        priority: 3,
        conditions: [{ field: "tag", operator: "in", value: ["suporte", "financeiro"] }],
        actionType: "TEAM",
        targetTeamId: teamSuporte.id,
        strategy: "LOWEST_LOAD",
        fallback: "QUEUE",
      },
    ],
  })

  const businessAccounts = new Map<string, Awaited<ReturnType<Db["businessAccount"]["create"]>>>()
  for (const account of [
    ["Atlas Commerce", "E-commerce", "Enterprise", "Rio de Janeiro", "RJ", "85000.00", "210000.00"],
    ["Clinica Vita", "Saude", "Cliente", "Belo Horizonte", "MG", "22600.00", "68400.00"],
    ["NovaLog Transportes", "Logistica", "Prospect", "Curitiba", "PR", "41600.00", "0"],
    ["Mobili Design", "Varejo", "Prospect", "Campinas", "SP", "18400.00", "0"],
    ["Solar Prime", "Energia", "Cliente", "Recife", "PE", "37200.00", "94800.00"],
  ] as const) {
    const [name, industry, status, city, state, value, ltv] = account
    const created = await db.businessAccount.create({
      data: {
        companyId: company.id,
        name,
        industry,
        status,
        city,
        state,
        value,
        ltv,
        website: `https://${name.toLowerCase().replaceAll(" ", "")}.com.br`,
        email: `contato@${name.toLowerCase().replaceAll(" ", "").replace("clinica", "clinica")}.com.br`,
        phone: "+55 11 3000-0000",
        size: status === "Enterprise" ? "201-500 colaboradores" : "21-80 colaboradores",
        notes: "Conta criada para demonstracao comercial com historico, contatos e oportunidades.",
      },
    })
    businessAccounts.set(name, created)
  }

  const customerSeeds = [
    {
      key: "bianca",
      account: "Atlas Commerce",
      owner: "rafael",
      name: "Bianca Torres",
      email: "bianca@atlascommerce.com.br",
      phone: "+55 21 98888-1010",
      city: "Rio de Janeiro",
      stage: "PROPOSTA" as const,
      status: "QUENTE" as const,
      source: "WHATSAPP" as const,
      segment: "Enterprise omnichannel",
      value: "85000.00",
      lifetimeValue: "210000.00",
      isVip: true,
      aiScore: 94,
      aiSentiment: "POSITIVO" as const,
      aiRisk: "BAIXO" as const,
      aiNextBestAction: "Enviar proposta revisada com SLA por canal e modulo de IA.",
      tags: ["alta-intencao", "enterprise", "whatsapp"],
    },
    {
      key: "carolina",
      account: "Clinica Vita",
      owner: "camila",
      name: "Carolina Mendes",
      email: "carolina@clinicavita.com.br",
      phone: "+55 31 97777-2020",
      city: "Belo Horizonte",
      stage: "POS_VENDA" as const,
      status: "CLIENTE" as const,
      source: "EMAIL" as const,
      segment: "Saude",
      value: "22600.00",
      lifetimeValue: "68400.00",
      isVip: true,
      aiScore: 78,
      aiSentiment: "NEUTRO" as const,
      aiRisk: "MEDIO" as const,
      aiNextBestAction: "Agendar check-in de sucesso e revisar uso do modulo financeiro.",
      tags: ["financeiro", "upsell"],
    },
    {
      key: "gustavo",
      account: "NovaLog Transportes",
      owner: "bruno",
      name: "Gustavo Pires",
      email: "gustavo@novalog.com.br",
      phone: "+55 41 96666-3030",
      city: "Curitiba",
      stage: "DEMONSTRACAO" as const,
      status: "EM_ANALISE" as const,
      source: "SITE" as const,
      segment: "Logistica",
      value: "41600.00",
      lifetimeValue: "0",
      isVip: false,
      aiScore: 86,
      aiSentiment: "POSITIVO" as const,
      aiRisk: "BAIXO" as const,
      aiNextBestAction: "Confirmar demo tecnica com integracao via webhook.",
      tags: ["demo-agendada", "alta-intencao"],
    },
    {
      key: "mariana",
      account: "Mobili Design",
      owner: "livia",
      name: "Mariana Freitas",
      email: "mariana@mobili.design",
      phone: "+55 19 95555-4040",
      city: "Campinas",
      stage: "QUALIFICACAO" as const,
      status: "NUTRICAO" as const,
      source: "INSTAGRAM" as const,
      segment: "Varejo",
      value: "18400.00",
      lifetimeValue: "0",
      isVip: false,
      aiScore: 61,
      aiSentiment: "NEUTRO" as const,
      aiRisk: "MEDIO" as const,
      aiNextBestAction: "Nutrir com caso de uso de loja fisica e WhatsApp.",
      tags: ["whatsapp"],
    },
    {
      key: "andre",
      account: "Solar Prime",
      owner: "paulo",
      name: "Andre Tavares",
      email: "andre@solarprime.com.br",
      phone: "+55 81 94444-5050",
      city: "Recife",
      stage: "POS_VENDA" as const,
      status: "CLIENTE" as const,
      source: "INDICACAO" as const,
      segment: "Energia solar",
      value: "37200.00",
      lifetimeValue: "94800.00",
      isVip: true,
      aiScore: 42,
      aiSentiment: "NEGATIVO" as const,
      aiRisk: "ALTO" as const,
      aiNextBestAction: "Priorizar atendimento humano e revisar reclamacoes sobre SLA.",
      tags: ["suporte", "risco-churn"],
    },
    {
      key: "eduardo",
      account: "Mobili Design",
      owner: "bruno",
      name: "Eduardo Ramos",
      email: "eduardo@ramosarquitetura.com",
      phone: "+55 48 93333-6060",
      city: "Florianopolis",
      stage: "PROSPECCAO" as const,
      status: "EM_ANALISE" as const,
      source: "ORGANICO" as const,
      segment: "Servicos",
      value: "9600.00",
      lifetimeValue: "0",
      isVip: false,
      aiScore: 54,
      aiSentiment: "POSITIVO" as const,
      aiRisk: "BAIXO" as const,
      aiNextBestAction: "Enviar material introdutorio e sugerir plano Starter.",
      tags: ["demo-agendada"],
    },
  ]

  const customers = new Map<string, Awaited<ReturnType<Db["customer"]["create"]>>>()
  for (const [index, seed] of customerSeeds.entries()) {
    const customer = await db.customer.create({
      data: {
        companyId: company.id,
        businessAccountId: businessAccounts.get(seed.account)!.id,
        ownerId: users.get(seed.owner)!.id,
        name: seed.name,
        companyName: seed.account,
        email: seed.email,
        phone: seed.phone,
        city: seed.city,
        stage: seed.stage,
        status: seed.status,
        source: seed.source,
        segment: seed.segment,
        value: seed.value,
        lifetimeValue: seed.lifetimeValue,
        isVip: seed.isVip,
        aiScore: seed.aiScore,
        aiSentiment: seed.aiSentiment,
        aiRisk: seed.aiRisk,
        aiNextBestAction: seed.aiNextBestAction,
        lastContactAt: hoursAgo(index * 7 + 1),
        tags: {
          create: seed.tags.map((tag) => ({ tagId: tags.get(tag)! })),
        },
        attendants: {
          create: [
            { userId: users.get(seed.owner)!.id, name: users.get(seed.owner)!.name, role: "Responsavel comercial", description: "Dono da oportunidade" },
            { name: "IA SDR Inbound", role: "Agente IA", description: "Primeira qualificacao automatizada" },
          ],
        },
        chatHistory: {
          create: [
            { channel: seed.source === "EMAIL" ? "EMAIL" : "WHATSAPP", occurredAt: hoursAgo(index * 8 + 2), topic: "Qualificacao e contexto da conta", sentiment: seed.aiSentiment === "NEGATIVO" ? "NEGATIVO" : "POSITIVO" },
            { channel: "TELEFONE", occurredAt: hoursAgo(index * 12 + 12), topic: "Alinhamento de proximos passos", sentiment: "NEUTRO" },
          ],
        },
        aiFindings: {
          create: [
            { text: seed.aiNextBestAction },
            { text: seed.aiRisk === "ALTO" ? "Conta com risco alto por insatisfacao recente." : "Boa aderencia entre dor declarada e oferta da plataforma." },
          ],
        },
      },
    })
    customers.set(seed.key, customer)
  }

  const categoryAutomacao = await db.productCategory.create({
    data: { companyId: company.id, name: "Automacao e IA", description: "Planos e modulos de automacao comercial." },
  })
  const categoryServicos = await db.productCategory.create({
    data: { companyId: company.id, name: "Servicos Profissionais", description: "Implantacao, treinamento e consultoria." },
  })
  const products = new Map<string, Awaited<ReturnType<Db["catalogProduct"]["create"]>>>()
  for (const product of [
    ["scale", "Plano Scale Mensal", "ZV-SCALE", categoryAutomacao.id, "1990.00"],
    ["ia", "Pacote IA Conversacional", "ZV-AI-PLUS", categoryAutomacao.id, "790.00"],
    ["implantacao", "Implantacao assistida", "ZV-IMPL-30", categoryServicos.id, "3500.00"],
    ["treinamento", "Treinamento comercial", "ZV-TRAIN", categoryServicos.id, "1200.00"],
    ["webhook", "Conector webhook dedicado", "ZV-WEBHOOK", categoryAutomacao.id, "650.00"],
  ] as const) {
    const [key, name, sku, categoryId, price] = product
    const created = await db.catalogProduct.create({
      data: {
        companyId: company.id,
        categoryId,
        name,
        sku,
        price,
        description: "Item demonstrativo usado em orcamentos e propostas comerciais.",
      },
    })
    products.set(key, created)
  }

  await db.customerProduct.createMany({
    data: [
      { customerId: customers.get("carolina")!.id, productName: "Plano Growth", status: "ATIVO", price: "897.00", description: "Plano atual com 10 usuarios." },
      { customerId: customers.get("andre")!.id, productName: "Plano Scale", status: "ATIVO", price: "1990.00", description: "Operacao com suporte e funil avancado." },
      { customerId: customers.get("bianca")!.id, productName: "Projeto Enterprise", status: "PENDENTE", price: "85000.00", description: "Proposta em negociacao." },
    ],
  })

  const conversationSeeds = [
    {
      customer: "bianca",
      agent: "sdr",
      attendant: "rafael",
      channel: "WHATSAPP" as const,
      status: "ALTA_INTENCAO" as const,
      leadValue: "85000.00",
      tone: "Consultivo",
      tags: ["alta-intencao", "enterprise", "whatsapp"],
      aiReason: "Lead enterprise com dor clara de centralizacao omnichannel e prazo de decisao curto.",
      nextAction: "Enviar proposta revisada e agendar apresentacao executiva.",
      messages: [
        ["CLIENTE", "Bianca Torres", "Estamos avaliando uma central omnichannel para vendas. Hoje o time perde historico entre WhatsApp, Instagram e e-mail."],
        ["AGENTE_IA", "IA SDR Inbound", "Entendi, Bianca. Quantas pessoas atendem hoje e qual canal concentra mais volume?"],
        ["CLIENTE", "Bianca Torres", "Sao 38 pessoas. WhatsApp e o maior, mas Instagram cresce muito em campanhas."],
        ["ATENDENTE", "Rafael Nogueira", "Perfeito. Vou montar a proposta Enterprise com SLA por canal, IA e visao gerencial para sua operacao."],
      ],
    },
    {
      customer: "andre",
      agent: "suporte",
      attendant: "paulo",
      channel: "WHATSAPP" as const,
      status: "AGUARDANDO" as const,
      leadValue: "37200.00",
      tone: "Urgente",
      tags: ["suporte", "risco-churn"],
      aiReason: "Cliente ativo com reclamacao de tempo de resposta e risco alto de churn.",
      nextAction: "Priorizar contato humano, revisar filas e prometer retorno com diagnostico.",
      messages: [
        ["CLIENTE", "Andre Tavares", "Estamos com mensagens acumulando desde ontem. O time esta reclamando que a fila nao distribui corretamente."],
        ["AGENTE_IA", "IA Suporte N1", "Vou verificar os sintomas com voce. Isso ocorre em todos os atendentes ou apenas em uma fila especifica?"],
        ["CLIENTE", "Andre Tavares", "Principalmente na fila pos-venda. Preciso de retorno hoje."],
        ["ATENDENTE", "Paulo Azevedo", "Andre, assumi o caso. Vou revisar regras e conectores agora e te retorno com o diagnostico ate 15h."],
      ],
    },
    {
      customer: "gustavo",
      agent: "sdr",
      attendant: "bruno",
      channel: "SITE" as const,
      status: "EM_ANALISE" as const,
      leadValue: "41600.00",
      tone: "Tecnico",
      tags: ["demo-agendada", "alta-intencao"],
      aiReason: "Lead tecnico interessado em integracao com CRM proprio e rastreabilidade de conversas.",
      nextAction: "Confirmar demo tecnica e solicitar documentacao do endpoint.",
      messages: [
        ["CLIENTE", "Gustavo Pires", "Conseguimos integrar os leads de WhatsApp ao nosso CRM proprio via API REST?"],
        ["AGENTE_IA", "IA SDR Inbound", "Sim. A ZapTech pode enviar eventos via webhook e receber atualizacoes por API. Voces ja possuem endpoint de criacao de lead?"],
        ["CLIENTE", "Gustavo Pires", "Temos sim. Quero ver isso em uma demo tecnica."],
        ["ATENDENTE", "Bruno Almeida", "Fechado. Posso agendar amanha as 10h com foco em webhooks e historico completo."],
      ],
    },
    {
      customer: "carolina",
      agent: "financeiro",
      attendant: "camila",
      channel: "EMAIL" as const,
      status: "RESOLVIDO" as const,
      leadValue: "22600.00",
      tone: "Objetivo",
      tags: ["financeiro", "upsell"],
      aiReason: "Cliente pediu segunda via e avaliou expansao de plano.",
      nextAction: "Registrar envio e retomar conversa de upsell na proxima semana.",
      messages: [
        ["CLIENTE", "Carolina Mendes", "Preciso da segunda via da fatura e quero avaliar a troca para Scale."],
        ["ATENDENTE", "Camila Rocha", "Carolina, enviei a segunda via e deixei pronta uma simulacao do Scale para voce comparar."],
        ["CLIENTE", "Carolina Mendes", "Recebido. Obrigada pelo retorno rapido."],
      ],
    },
    {
      customer: "mariana",
      agent: "sdr",
      attendant: "livia",
      channel: "INSTAGRAM" as const,
      status: "EM_ANALISE" as const,
      leadValue: "18400.00",
      tone: "Amigavel",
      tags: ["whatsapp"],
      aiReason: "Lead de varejo em fase inicial, precisa entender valor antes de proposta.",
      nextAction: "Enviar caso de uso de loja fisica e perguntar volume mensal.",
      messages: [
        ["CLIENTE", "Mariana Freitas", "Vi o anuncio de voces. Da para usar so para WhatsApp da loja?"],
        ["AGENTE_IA", "IA SDR Inbound", "Da sim, Mariana. A plataforma organiza atendimentos, tags e funil mesmo com um unico canal. Quantos atendimentos voces recebem por dia?"],
        ["CLIENTE", "Mariana Freitas", "Entre 80 e 120, principalmente orcamentos."],
      ],
    },
    {
      customer: "eduardo",
      agent: "sdr",
      attendant: "bruno",
      channel: "EMAIL" as const,
      status: "AGUARDANDO" as const,
      leadValue: "9600.00",
      tone: "Educativo",
      tags: ["demo-agendada"],
      aiReason: "Lead organico pequeno, boa aderencia ao plano Starter.",
      nextAction: "Enviar convite de demo e material introdutorio.",
      messages: [
        ["CLIENTE", "Eduardo Ramos", "Gostaria de entender a plataforma para uma equipe pequena de atendimento."],
        ["ATENDENTE", "Bruno Almeida", "Eduardo, consigo te mostrar em 30 minutos como organizar WhatsApp, funil e orcamentos. Amanha as 15h funciona?"],
        ["CLIENTE", "Eduardo Ramos", "Funciona sim. Pode enviar o convite."],
      ],
    },
  ]

  const conversations = new Map<string, Awaited<ReturnType<Db["conversation"]["create"]>>>()
  for (const [index, seed] of conversationSeeds.entries()) {
    const lastMessageAt = hoursAgo(index * 4 + 1)
    const conversation = await db.conversation.create({
      data: {
        companyId: company.id,
        customerId: customers.get(seed.customer)!.id,
        agentId: agents.get(seed.agent)!.id,
        attendantId: users.get(seed.attendant)!.id,
        channel: seed.channel,
        status: seed.status,
        leadValue: seed.leadValue,
        aiReason: seed.aiReason,
        nextAction: seed.nextAction,
        tone: seed.tone,
        preview: seed.messages[seed.messages.length - 1][2].slice(0, 190),
        lastMessageAt,
        lastReadAt: index < 3 ? hoursAgo(index * 4 + 2) : lastMessageAt,
        messages: {
          create: seed.messages.map(([role, authorName, text], messageIndex) => ({
            role,
            authorName,
            text,
            isAiGenerated: role === "AGENTE_IA",
            align: role === "CLIENTE" ? "left" : "right",
            createdAt: new Date(lastMessageAt.getTime() - (seed.messages.length - messageIndex - 1) * 11 * 60 * 1000),
          })),
        },
        tags: { create: seed.tags.map((tag) => ({ tagId: tags.get(tag)! })) },
      },
    })
    conversations.set(seed.customer, conversation)
  }

  await db.outboundMessage.createMany({
    data: [
      {
        companyId: company.id,
        conversationId: conversations.get("bianca")!.id,
        instanceId: "zaptech-demo-main",
        recipientPhone: "+5521988881010",
        body: "Bianca, segue a proposta Enterprise revisada com SLA por canal e IA.",
        status: "QUEUED",
        priority: 2,
        clientRequestId: "demo-out-bianca-proposta",
        createdByUserId: users.get("rafael")!.id,
      },
      {
        companyId: company.id,
        conversationId: conversations.get("andre")!.id,
        instanceId: "zaptech-demo-main",
        recipientPhone: "+5581944445050",
        body: "Andre, estou finalizando o diagnostico da fila pos-venda e ja te retorno.",
        status: "SENT",
        priority: 1,
        sentAt: hoursAgo(2),
        waMessageId: "wamid.demo.andre.001",
        clientRequestId: "demo-out-andre-retorno",
        createdByUserId: users.get("paulo")!.id,
      },
    ],
  })

  await db.inboundMessage.createMany({
    data: [
      {
        companyId: company.id,
        instanceId: "zaptech-demo-main",
        waMessageId: "wamid.demo.in.001",
        senderPhone: "+5521988881010",
        messageType: "conversation",
        payload: { text: "Podemos revisar usuarios inclusos?", demo: true },
        status: "DONE",
        attempts: 1,
        processedAt: hoursAgo(5),
        receivedAt: hoursAgo(5),
      },
      {
        companyId: company.id,
        instanceId: "zaptech-demo-main",
        waMessageId: "wamid.demo.in.002",
        senderPhone: "+5581944445050",
        messageType: "conversation",
        payload: { text: "A fila de pos-venda travou de novo.", demo: true },
        status: "DONE",
        attempts: 1,
        nextAttemptAt: new Date(),
        processedAt: hoursAgo(1),
        receivedAt: hoursAgo(1),
      },
    ],
  })

  const commercialBoard = await db.kanbanBoard.create({
    data: {
      companyId: company.id,
      name: "Pipeline Comercial Demo",
      sortOrder: 0,
      columns: {
        create: [
          { name: "Prospeccao", sortOrder: 0, color: "#e0f2fe", probability: 10, slaHours: 24 },
          { name: "Qualificacao", sortOrder: 1, color: "#dbeafe", probability: 25, slaHours: 18 },
          { name: "Demo", sortOrder: 2, color: "#ede9fe", probability: 45, slaHours: 36 },
          { name: "Proposta", sortOrder: 3, color: "#dcfce7", probability: 70, slaHours: 48 },
          { name: "Negociacao", sortOrder: 4, color: "#fef3c7", probability: 85, slaHours: 72 },
          { name: "Fechado", sortOrder: 5, color: "#bbf7d0", probability: 100, slaHours: 0 },
        ],
      },
    },
    include: { columns: true },
  })
  const columnByName = new Map(commercialBoard.columns.map((column) => [column.name, column]))
  for (const card of [
    ["Atlas Commerce", "Proposta", "bianca", "rafael", 94, "URGENTE", "85000.00", 5],
    ["NovaLog Transportes", "Demo", "gustavo", "bruno", 86, "ALTA", "41600.00", 4],
    ["Mobili Design", "Qualificacao", "mariana", "livia", 61, "MEDIA", "18400.00", 2],
    ["Ramos Arquitetura", "Prospeccao", "eduardo", "bruno", 54, "BAIXA", "9600.00", 1],
    ["Clinica Vita - Expansao", "Negociacao", "carolina", "camila", 78, "ALTA", "22600.00", 3],
  ] as const) {
    const [name, columnName, customerKey, userKey, score, priority, value, dots] = card
    await db.kanbanCard.create({
      data: {
        columnId: columnByName.get(columnName)!.id,
        customerId: customers.get(customerKey)!.id,
        assignedUserId: users.get(userKey)!.id,
        initials: initials(name),
        name,
        description: "Oportunidade criada pelo seed demo com historico realista.",
        score,
        scoreBreakdown: { perfil: score - 12, engajamento: score + 4, urgencia: score - 6 },
        priority,
        dots,
        value,
        expectedCloseAt: daysFromNow(dots * 4),
        contactName: customers.get(customerKey)!.name,
        contactEmail: customers.get(customerKey)!.email,
        contactPhone: customers.get(customerKey)!.phone,
        activities: {
          create: [
            { type: "WHATSAPP", title: "Contato recente", content: "Cliente respondeu e confirmou interesse.", authorName: users.get(userKey)!.name, doneAt: hoursAgo(dots + 1) },
            { type: "TAREFA", title: "Proximo passo", content: "Preparar follow-up com base na ultima conversa.", authorName: "Sistema" },
          ],
        },
      },
    })
  }

  const segmentEnterprise = await db.segment.create({
    data: {
      companyId: company.id,
      name: "Enterprise alta intencao",
      criteria: JSON.stringify([{ field: "value", operator: "gte", value: 40000 }, { field: "aiScore", operator: "gte", value: 80 }]),
      value: "126600.00",
      customers: { create: [{ customerId: customers.get("bianca")!.id }, { customerId: customers.get("gustavo")!.id }] },
    },
  })
  const segmentRetencao = await db.segment.create({
    data: {
      companyId: company.id,
      name: "Clientes em risco de churn",
      criteria: JSON.stringify([{ field: "aiRisk", operator: "in", value: ["MEDIO", "ALTO"] }]),
      value: "59800.00",
      customers: { create: [{ customerId: customers.get("andre")!.id }, { customerId: customers.get("carolina")!.id }] },
    },
  })

  const campaign = await db.campaign.create({
    data: {
      companyId: company.id,
      segmentId: segmentEnterprise.id,
      name: "Demo Scale Maio",
      type: "AQUISICAO",
      status: "ATIVA",
      budget: "12500.00",
      leadCount: 184,
    },
  })
  await db.broadcast.createMany({
    data: [
      { companyId: company.id, segmentId: segmentEnterprise.id, name: "Convite para demo executiva", channel: "WHATSAPP", status: "AGENDADA", contactCount: 184, scheduledAt: daysFromNow(1) },
      { companyId: company.id, segmentId: segmentRetencao.id, name: "Check-in de sucesso do cliente", channel: "EMAIL", status: "EM_ENVIO", contactCount: 42, scheduledAt: hoursAgo(1) },
      { companyId: company.id, segmentId: segmentEnterprise.id, name: "Resumo de cases omnichannel", channel: "WHATSAPP", status: "CONCLUIDA", contactCount: 156, scheduledAt: hoursAgo(48) },
    ],
  })

  const qrLink = await db.dynamicQrLink.create({
    data: {
      companyId: company.id,
      campaignId: campaign.id,
      slug: "zaptech-demo-scale",
      name: "QR WhatsApp - Stand Demo Scale",
      messageTemplate: "Ola, vim pelo QR da demonstracao e quero conhecer a ZapTech.",
      utmSource: "evento",
      utmMedium: "qr-code",
      utmCampaign: "Demo Scale Maio",
      utmContent: "stand-principal",
      status: "ATIVO",
      clickCount: 4,
      lastClickedAt: hoursAgo(3),
    },
  })
  await db.dynamicQrClick.createMany({
    data: [1, 2, 3, 4].map((offset) => ({
      linkId: qrLink.id,
      companyId: company.id,
      clickedAt: hoursAgo(offset * 3),
      destinationPhone: "+551140022026",
      utmSource: "evento",
      utmMedium: "qr-code",
      utmCampaign: "Demo Scale Maio",
      utmContent: "stand-principal",
      referrer: offset % 2 === 0 ? "linkedin" : "evento-presencial",
    })),
  })

  const quoteItems = [
    { product: products.get("scale")!, quantity: "12", unitPrice: "1990.00", subtotal: "23880.00", discountAmount: "2388.00", total: "21492.00" },
    { product: products.get("ia")!, quantity: "12", unitPrice: "790.00", subtotal: "9480.00", discountAmount: "948.00", total: "8532.00" },
    { product: products.get("implantacao")!, quantity: "1", unitPrice: "3500.00", subtotal: "3500.00", discountAmount: "0", total: "3500.00" },
  ]
  const quote = await db.quote.create({
    data: {
      companyId: company.id,
      customerId: customers.get("bianca")!.id,
      conversationId: conversations.get("bianca")!.id,
      generatedById: users.get("rafael")!.id,
      number: 1001,
      status: "ENVIADO",
      validUntil: daysFromNow(10),
      notes: "Proposta demo com licencas anuais, IA e implantacao assistida.",
      freight: "0",
      subtotal: "36860.00",
      discountTotal: "3336.00",
      total: "33524.00",
      sentAt: hoursAgo(6),
      items: {
        create: quoteItems.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          categoryName: "Automacao e IA",
          sku: item.product.sku,
          unit: item.product.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountType: "PERCENTUAL",
          discountValue: "10",
          subtotal: item.subtotal,
          discountAmount: item.discountAmount,
          total: item.total,
        })),
      },
      events: {
        create: [
          { type: "CRIADO", authorId: users.get("rafael")!.id, authorName: "Rafael Nogueira", message: "Orcamento criado a partir da conversa enterprise." },
          { type: "ENVIADO", authorId: users.get("rafael")!.id, authorName: "Rafael Nogueira", message: "Proposta enviada por WhatsApp e e-mail." },
        ],
      },
    },
  })
  await db.quote.create({
    data: {
      companyId: company.id,
      customerId: customers.get("carolina")!.id,
      conversationId: conversations.get("carolina")!.id,
      generatedById: users.get("camila")!.id,
      number: 1002,
      status: "ACEITO",
      validUntil: daysFromNow(15),
      notes: "Expansao aceita para modulo de IA e treinamento.",
      freight: "0",
      subtotal: "4700.00",
      discountTotal: "0",
      total: "4700.00",
      sentAt: hoursAgo(30),
      items: {
        create: [
          { productId: products.get("ia")!.id, productName: "Pacote IA Conversacional", categoryName: "Automacao e IA", sku: "ZV-AI-PLUS", quantity: "1", unitPrice: "790.00", subtotal: "790.00", discountAmount: "0", total: "790.00" },
          { productId: products.get("treinamento")!.id, productName: "Treinamento comercial", categoryName: "Servicos Profissionais", sku: "ZV-TRAIN", quantity: "3", unitPrice: "1200.00", subtotal: "3600.00", discountAmount: "0", total: "3600.00" },
          { productId: products.get("webhook")!.id, productName: "Conector webhook dedicado", categoryName: "Automacao e IA", sku: "ZV-WEBHOOK", quantity: "1", unitPrice: "310.00", subtotal: "310.00", discountAmount: "0", total: "310.00" },
        ],
      },
      events: {
        create: [
          { type: "CRIADO", authorId: users.get("camila")!.id, authorName: "Camila Rocha", message: "Proposta de expansao criada." },
          { type: "ACEITO", authorId: users.get("camila")!.id, authorName: "Camila Rocha", message: "Cliente aprovou pacote de expansao." },
        ],
      },
    },
  })

  const articleSeeds = [
    ["Conectar WhatsApp Oficial", "Canais", "Passo a passo para conectar e validar uma instancia de WhatsApp oficial.", "whatsapp,canais,onboarding"],
    ["Como configurar regras de distribuicao", "Operacao", "Boas praticas para rotear leads por equipe, valor e canal de entrada.", "roteamento,crm,sla"],
    ["Playbook de follow-up comercial", "Vendas", "Cadencia recomendada para leads inbound de alta intencao.", "vendas,follow-up,proposta"],
  ] as const
  for (const [title, category, content, tagsText] of articleSeeds) {
    const article = await db.knowledgeArticle.create({
      data: {
        companyId: company.id,
        createdById: users.get("camila")!.id,
        title,
        category,
        content,
        tags: tagsText,
        channels: JSON.stringify(["WHATSAPP", "EMAIL"]),
        status: "PUBLICADO",
      },
    })
    const version = await db.knowledgeArticleVersion.create({
      data: {
        articleId: article.id,
        createdById: users.get("camila")!.id,
        version: 1,
        status: "PUBLICADO",
        content,
        publishedAt: hoursAgo(72),
      },
    })
    await db.knowledgeArticle.update({
      where: { id: article.id },
      data: { publishedVersionId: version.id },
    })
  }

  const workflow = await db.workflow.create({
    data: {
      companyId: company.id,
      name: "Qualificacao inbound com IA",
      description: "Fluxo demo para capturar, qualificar e encaminhar leads de alta intencao.",
      status: "ATIVO",
      executionCount: 318,
      lastRunAt: hoursAgo(2),
    },
  })
  const nodeStart = await db.flowNode.create({
    data: { workflowId: workflow.id, externalId: "start", title: "Nova conversa recebida", type: "ASSISTENTE_IA", agentId: agents.get("sdr")!.id, sortOrder: 0, body: "Qualificar lead e identificar dor principal." },
  })
  const nodeCondition = await db.flowNode.create({
    data: { workflowId: workflow.id, externalId: "score", title: "Score maior que 80?", type: "CONDICAO", sortOrder: 1, body: "Analisa score, valor potencial e urgencia." },
  })
  const nodeTransfer = await db.flowNode.create({
    data: { workflowId: workflow.id, externalId: "transfer", title: "Transferir para closer", type: "TRANSFERIR_AGENTE", sortOrder: 2, body: "Encaminhar para time Comercial Inbound." },
  })
  const nodeNurture = await db.flowNode.create({
    data: { workflowId: workflow.id, externalId: "nurture", title: "Enviar material de nutricao", type: "ENVIAR_MENSAGEM", sortOrder: 3, body: "Enviar case e pedir melhor horario para conversa." },
  })
  await db.flowBranch.createMany({
    data: [
      { nodeId: nodeStart.id, label: "proximo", sortOrder: 0, targetNodeId: nodeCondition.id },
      { nodeId: nodeCondition.id, label: "sim", sortOrder: 0, targetNodeId: nodeTransfer.id },
      { nodeId: nodeCondition.id, label: "nao", sortOrder: 1, targetNodeId: nodeNurture.id },
    ],
  })

  await db.aIAudit.create({
    data: {
      companyId: company.id,
      conversationId: conversations.get("andre")!.id,
      conversationName: "Atendimento Solar Prime",
      attendantId: users.get("paulo")!.id,
      score: 58,
      riskLevel: "ALTO",
      recommendation: "Reduzir tempo de primeira resposta e confirmar prazo de retorno com clareza.",
      sentiment: "NEGATIVO",
      category: "TECNICA",
      dimension: "sla",
      suggestionsSummary: "Priorizar atendimento humano, registrar diagnostico e acompanhar ate resolucao.",
      suggestions: [
        { title: "Resposta imediata", description: "Assumir o caso com horario de retorno objetivo.", timeframe: "Hoje", impact: "Alto" },
        { title: "Revisar regra", description: "Checar roteamento da fila pos-venda.", timeframe: "Hoje", impact: "Alto" },
      ],
      findings: {
        create: [
          { text: "Cliente demonstrou urgencia e insatisfacao com a fila." },
          { text: "Atendente assumiu o caso, mas deve registrar follow-up dentro do SLA." },
        ],
      },
    },
  })
  await db.aIAudit.create({
    data: {
      companyId: company.id,
      conversationId: conversations.get("bianca")!.id,
      conversationName: "Proposta Atlas Commerce",
      attendantId: users.get("rafael")!.id,
      score: 91,
      riskLevel: "BAIXO",
      recommendation: "Manter cadencia executiva e reforcar diferenciais de SLA por canal.",
      sentiment: "POSITIVO",
      category: "SOFT_SKILLS",
      dimension: "comunicacao",
      suggestionsSummary: "Bom alinhamento entre necessidade e proposta.",
      suggestions: [{ title: "Follow-up executivo", description: "Enviar resumo com ROI e cronograma.", timeframe: "24h", impact: "Medio" }],
      findings: {
        create: [
          { text: "Atendente conduziu bem a descoberta de volume e canais." },
          { text: "Proxima mensagem deve trazer proposta objetiva e convite para reuniao." },
        ],
      },
    },
  })

  await db.supportTicket.create({
    data: {
      companyId: company.id,
      code: "SUP-1001",
      title: "Fila pos-venda nao distribui novas mensagens",
      customer: "Solar Prime",
      contact: "Andre Tavares",
      channel: "WhatsApp",
      conversationId: conversations.get("andre")!.id,
      category: "Integracao",
      priority: "Alta",
      status: "Em andamento",
      team: "Suporte e CS",
      assignee: "Paulo Azevedo",
      slaState: "Em risco",
      slaDueAt: daysFromNow(0.25),
      summary: "Cliente relata acumulacao de mensagens na fila pos-venda desde ontem.",
      tags: ["fila", "whatsapp", "sla"],
      activity: {
        create: [
          { authorName: "IA Suporte N1", text: "Ticket aberto automaticamente a partir da conversa com sentimento negativo." },
          { authorName: "Paulo Azevedo", text: "Iniciada revisao das regras de distribuicao e status do conector." },
        ],
      },
    },
  })
  await db.supportTicket.create({
    data: {
      companyId: company.id,
      code: "SUP-1002",
      title: "Permissao expirada no Google Calendar",
      customer: "ZapTech Solutions",
      contact: "Camila Rocha",
      channel: "Sistema",
      category: "Agenda",
      priority: "Media",
      status: "Novo",
      team: "Suporte e CS",
      assignee: "Camila Rocha",
      slaState: "No prazo",
      slaDueAt: daysFromNow(1),
      summary: "Conector de agenda em estado Revisar para renovacao de permissao.",
      tags: ["agenda", "conector"],
      activity: { create: [{ authorName: "Sistema", text: "Alerta gerado pelo status do conector Google Calendar." }] },
    },
  })

  await db.invoice.create({
    data: {
      companyId: company.id,
      planId: plan.id,
      status: "PAGO",
      method: "PIX",
      amount: "1990.00",
      dueDate: daysFromNow(-12),
      paidAt: daysFromNow(-11),
      notes: "Fatura demo paga para plano Scale.",
      lineItems: {
        create: [
          { description: "Plano Scale - mensalidade", quantity: 1, unitPrice: "1990.00", total: "1990.00" },
        ],
      },
    },
  })
  await db.invoice.create({
    data: {
      companyId: company.id,
      planId: plan.id,
      status: "PENDENTE",
      method: "BOLETO",
      amount: "2380.00",
      dueDate: daysFromNow(18),
      notes: "Fatura demo proxima com usuario adicional e pacote de IA.",
      lineItems: {
        create: [
          { description: "Plano Scale - mensalidade", quantity: 1, unitPrice: "1990.00", total: "1990.00" },
          { description: "Usuarios adicionais", quantity: 2, unitPrice: "29.00", total: "58.00" },
          { description: "Chats extras demonstrativos", quantity: 8, unitPrice: "39.00", total: "312.00" },
          { description: "Ajuste operacional demo", quantity: 1, unitPrice: "20.00", total: "20.00" },
        ],
      },
    },
  })

  await db.metric.createMany({
    data: [
      { companyId: company.id, label: "Receita no pipeline", value: "R$ 286.400", change: "+18,2%", period: "mes atual" },
      { companyId: company.id, label: "Conversas ativas", value: "428", change: "+12%", period: "7 dias" },
      { companyId: company.id, label: "Taxa de conversao", value: "31,5%", change: "+4,1 p.p.", period: "mes atual" },
      { companyId: company.id, label: "Tempo medio de resposta", value: "2m 18s", change: "-36s", period: "7 dias" },
      { companyId: company.id, label: "CSAT", value: "92%", change: "+3 p.p.", period: "30 dias" },
      { companyId: company.id, label: "Leads novos", value: "184", change: "+27", period: "mes atual" },
    ],
  })

  console.log(`✓ Demo company seeded: ${company.name} (${company.slug})`)
  console.log(`✓ Demo users: marina/rafael/camila/bruno/livia/paulo@${DEMO_DOMAIN} senha ${DEMO_PASSWORD}`)
  console.log(`✓ Demo admin: admin@${DEMO_DOMAIN} senha ZapTechAdmin@123`)
  console.log(`✓ Demo quote created: #${quote.number}`)
}
