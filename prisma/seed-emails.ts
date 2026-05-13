import "dotenv/config"
import { PrismaClient, type Prisma } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

const EMAIL_THREADS = [
  {
    name: "Helena Duarte",
    email: "helena@aurorafoods.com.br",
    companyName: "Aurora Foods",
    city: "São Paulo",
    status: "ALTA_INTENCAO" as const,
    stage: "PROPOSTA" as const,
    source: "EMAIL" as const,
    value: "18400",
    isVip: true,
    leadValue: "18400",
    tags: ["renovacao", "proposta"],
    subject: "Re: Proposta para expansão do atendimento",
    messages: [
      ["CLIENTE", "Helena Duarte", "Olá, bom dia. Revisei a proposta e queria entender se conseguimos incluir mais dois usuários no pacote sem mudar o prazo de implantação."],
      ["ATENDENTE", "Atendente Demo", "Bom dia, Helena. Conseguimos incluir os dois usuários e manter o cronograma. Vou te mandar a revisão com o impacto no valor mensal."],
      ["CLIENTE", "Helena Duarte", "Perfeito. Se ficar dentro do orçamento, consigo aprovar ainda esta semana."],
    ],
  },
  {
    name: "Gustavo Pires",
    email: "gustavo@novalog.com",
    companyName: "NovaLog",
    city: "Curitiba",
    status: "EM_ANALISE" as const,
    stage: "QUALIFICACAO" as const,
    source: "EMAIL" as const,
    value: "9200",
    isVip: false,
    leadValue: "9200",
    tags: ["integracao", "crm"],
    subject: "Dúvidas sobre integração com CRM",
    messages: [
      ["CLIENTE", "Gustavo Pires", "Oi, equipe. Vocês conseguem integrar os leads de e-mail e WhatsApp no nosso CRM atual? Usamos um CRM próprio com API REST."],
      ["ATENDENTE", "Atendente Demo", "Oi, Gustavo. Sim, conseguimos integrar via webhook ou API REST. Você pode me enviar a documentação do endpoint de criação de leads?"],
      ["CLIENTE", "Gustavo Pires", "Posso sim. Também preciso saber se dá para registrar o histórico completo da conversa."],
    ],
  },
  {
    name: "Carolina Mendes",
    email: "carolina@clinicavita.com.br",
    companyName: "Clínica Vita",
    city: "Belo Horizonte",
    status: "AGUARDANDO" as const,
    stage: "NEGOCIACAO" as const,
    source: "EMAIL" as const,
    value: "12600",
    isVip: true,
    leadValue: "12600",
    tags: ["financeiro", "urgente"],
    subject: "Solicitação de segunda via e ajuste de plano",
    messages: [
      ["CLIENTE", "Carolina Mendes", "Boa tarde. Preciso da segunda via da fatura e gostaria de avaliar a troca para o plano Growth antes do próximo ciclo."],
      ["ATENDENTE", "Atendente Demo", "Boa tarde, Carolina. Já separei a segunda via e vou simular a troca de plano para você comparar os valores."],
      ["CLIENTE", "Carolina Mendes", "Obrigada. Tenho uma reunião às 16h e seria ótimo chegar com esses números."],
    ],
  },
  {
    name: "Eduardo Ramos",
    email: "eduardo@ramosarquitetura.com",
    companyName: "Ramos Arquitetura",
    city: "Florianópolis",
    status: "EM_ANALISE" as const,
    stage: "DEMONSTRACAO" as const,
    source: "EMAIL" as const,
    value: "7800",
    isVip: false,
    leadValue: "7800",
    tags: ["demo", "site"],
    subject: "Agendamento de demonstração",
    messages: [
      ["CLIENTE", "Eduardo Ramos", "Olá. Vi o produto pelo site e gostaria de agendar uma demonstração focada em atendimento para equipes pequenas."],
      ["ATENDENTE", "Atendente Demo", "Olá, Eduardo. Claro. Temos horários amanhã às 10h ou 15h. Algum deles funciona para você?"],
      ["CLIENTE", "Eduardo Ramos", "Amanhã às 15h funciona bem. Pode enviar o convite por e-mail."],
    ],
  },
  {
    name: "Bianca Torres",
    email: "bianca@atlascommerce.com.br",
    companyName: "Atlas Commerce",
    city: "Rio de Janeiro",
    status: "ALTA_INTENCAO" as const,
    stage: "PROPOSTA" as const,
    source: "EMAIL" as const,
    value: "24500",
    isVip: true,
    leadValue: "24500",
    tags: ["enterprise", "omnichannel"],
    subject: "Projeto omnichannel para operação comercial",
    messages: [
      ["CLIENTE", "Bianca Torres", "Estamos avaliando uma central omnichannel para vendas. Precisamos atender WhatsApp, Instagram e e-mail em uma única operação."],
      ["ATENDENTE", "Atendente Demo", "Bianca, faz bastante sentido. O ZapVendas já centraliza os canais e mantém o histórico no cliente. Posso montar uma proposta Enterprise."],
      ["CLIENTE", "Bianca Torres", "Pode montar. O ponto principal é visibilidade de SLA por canal e automações com IA."],
    ],
  },
  {
    name: "Marcos Leme",
    email: "marcos@lemeparts.com",
    companyName: "Leme Parts",
    city: "Campinas",
    status: "RESOLVIDO" as const,
    stage: "POS_VENDA" as const,
    source: "EMAIL" as const,
    value: "5400",
    isVip: false,
    leadValue: "5400",
    tags: ["suporte", "resolvido"],
    subject: "Re: Confirmação de ajuste no cadastro",
    messages: [
      ["CLIENTE", "Marcos Leme", "Conferi aqui e o cadastro foi atualizado corretamente. Obrigado pelo retorno rápido."],
      ["ATENDENTE", "Atendente Demo", "Ótimo, Marcos. Fico feliz que tenha dado certo. Vou encerrar o atendimento, mas seguimos à disposição."],
    ],
  },
] as const

async function main() {
  const company = await db.company.findUnique({ where: { slug: "zapvendas-demo" } })
  if (!company) throw new Error("Rode tsx prisma/seed-company.ts primeiro")

  const tagIds = new Map<string, string>()
  for (const thread of EMAIL_THREADS) {
    for (const tagName of thread.tags) {
      if (tagIds.has(tagName)) continue
      const tag = await db.tag.upsert({
        where: { companyId_name: { companyId: company.id, name: tagName } },
        update: {},
        create: { companyId: company.id, name: tagName, color: "#0891b2" },
      })
      tagIds.set(tagName, tag.id)
    }
  }

  for (const [index, thread] of EMAIL_THREADS.entries()) {
    const existingCustomer = await db.customer.findFirst({
      where: { companyId: company.id, email: thread.email },
      select: { id: true },
    })
    const customerStatus = thread.status === "RESOLVIDO" ? "CLIENTE" as const : "EM_ANALISE" as const
    const customerData = {
      name: thread.name,
      companyName: thread.companyName,
      city: thread.city,
      status: customerStatus,
      stage: thread.stage,
      source: thread.source,
      value: thread.value,
      isVip: thread.isVip,
      lastContactAt: new Date(Date.now() - index * 36e5),
    } satisfies Prisma.CustomerUpdateInput
    const customer = existingCustomer
      ? await db.customer.update({
        where: { id: existingCustomer.id },
        data: customerData,
      })
      : await db.customer.create({
        data: {
          company: { connect: { id: company.id } },
          email: thread.email,
          ...customerData,
        },
      })

    let conversation = await db.conversation.findFirst({
      where: { companyId: company.id, customerId: customer.id, channel: "EMAIL" },
      select: { id: true },
    })

    const lastMessageAt = new Date(Date.now() - index * 42 * 60_000)
    const preview = thread.messages[thread.messages.length - 1][2].slice(0, 200)

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          channel: "EMAIL",
          status: thread.status,
          leadValue: thread.leadValue,
          preview,
          lastMessageAt,
          aiReason: `${thread.subject}. Prioridade sugerida com base no conteúdo do e-mail.`,
          nextAction: thread.status === "RESOLVIDO" ? "Registrar fechamento do atendimento." : "Responder e avançar o próximo passo por e-mail.",
        },
        select: { id: true },
      })
    } else {
      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          status: thread.status,
          leadValue: thread.leadValue,
          preview,
          lastMessageAt,
          aiReason: `${thread.subject}. Prioridade sugerida com base no conteúdo do e-mail.`,
          nextAction: thread.status === "RESOLVIDO" ? "Registrar fechamento do atendimento." : "Responder e avançar o próximo passo por e-mail.",
        },
      })
      await db.message.deleteMany({ where: { conversationId: conversation.id } })
      await db.conversationTagLink.deleteMany({ where: { conversationId: conversation.id } })
    }

    await db.message.createMany({
      data: thread.messages.map(([role, authorName, text], messageIndex) => ({
        conversationId: conversation.id,
        role,
        authorName,
        text,
        align: role === "ATENDENTE" ? "right" : "left",
        createdAt: new Date(lastMessageAt.getTime() - (thread.messages.length - messageIndex - 1) * 12 * 60_000),
      })),
    })

    await db.conversationTagLink.createMany({
      data: thread.tags.map((tagName) => ({
        conversationId: conversation.id,
        tagId: tagIds.get(tagName)!,
      })),
      skipDuplicates: true,
    })

    console.log(`✓ Email thread: ${thread.name} <${thread.email}>`)
  }

  console.log("\n🌱 Seed de e-mails concluído.")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
