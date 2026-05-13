-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ATIVA', 'TRIAL', 'INADIMPLENTE', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "PlanBilling" AS ENUM ('MENSAL', 'NEGOCIADO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'GESTOR', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'TRIAL', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "AdminUserRole" AS ENUM ('SUPER_ADMIN', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PAGO', 'VENCIDO', 'TRIAL', 'PENDENTE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "InvoicePaymentMethod" AS ENUM ('BOLETO', 'CARTAO', 'PIX', 'NEGOCIADO');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ALTA_INTENCAO', 'AGUARDANDO', 'EM_ANALISE', 'RESOLVIDO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'SITE', 'EMAIL', 'TELEFONE', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('CLIENTE', 'ATENDENTE', 'AGENTE_IA', 'SISTEMA');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('QUENTE', 'NUTRICAO', 'EM_ANALISE', 'CLIENTE', 'INATIVO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "CustomerStage" AS ENUM ('PROSPECCAO', 'QUALIFICACAO', 'DEMONSTRACAO', 'PROPOSTA', 'NEGOCIACAO', 'FECHADO', 'POS_VENDA');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'SITE', 'CAMPANHA_CRM', 'WEBHOOK', 'EMAIL', 'INDICACAO', 'ORGANICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('ATIVO', 'PAUSADO', 'RASCUNHO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('AGENDADA', 'EM_ENVIO', 'CONCLUIDA', 'RASCUNHO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('AQUISICAO', 'RETENCAO', 'ABM', 'REATIVACAO', 'UPSELL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ATIVA', 'PLANEJADA', 'PAUSADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('CANAL', 'CRM', 'ENTRADA', 'AGENDA', 'PAGAMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('CONECTADO', 'ATIVO', 'REVISAR', 'DESCONECTADO', 'ERRO');

-- CreateEnum
CREATE TYPE "FlowNodeType" AS ENUM ('ASSISTENTE_IA', 'ENVIAR_MENSAGEM', 'CONDICAO', 'ESPERA', 'WEBHOOK', 'TRANSFERIR_AGENTE', 'FINALIZAR');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVO', 'NEUTRO', 'NEGATIVO');

-- CreateEnum
CREATE TYPE "ChatSentiment" AS ENUM ('POSITIVO', 'NEUTRO', 'NEGATIVO');

-- CreateEnum
CREATE TYPE "KanbanPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ATIVO', 'CANCELADO', 'CONCLUIDO', 'PENDENTE');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "price" DECIMAL(10,2) NOT NULL,
    "billing" "PlanBilling" NOT NULL DEFAULT 'MENSAL',
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUsers" INTEGER,
    "maxChats" INTEGER,
    "maxAgents" INTEGER,
    "maxBoards" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "included" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanExtra" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "unitType" TEXT NOT NULL DEFAULT 'custom',

    CONSTRAINT "PlanExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'TRIAL',
    "planId" TEXT NOT NULL,
    "ownerName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "cnpj" TEXT,
    "city" TEXT,
    "mrr" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nextBilling" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "currentUsers" INTEGER NOT NULL DEFAULT 0,
    "currentChats" INTEGER NOT NULL DEFAULT 0,
    "currentAgents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ATENDENTE',
    "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
    "lastSeen" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AdminUserRole" NOT NULL DEFAULT 'FINANCEIRO',
    "passwordHash" TEXT,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'ZapVendas',
    "domain" TEXT NOT NULL DEFAULT 'app.zapvendas.com.br',
    "supportEmail" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "gateway" TEXT NOT NULL DEFAULT 'Stripe',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "trialWarnDays" INTEGER NOT NULL DEFAULT 3,
    "invoiceOverdueDays" INTEGER NOT NULL DEFAULT 3,
    "chatUsageThreshold" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDENTE',
    "method" "InvoicePaymentMethod",
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "agentId" TEXT,
    "attendantId" TEXT,
    "channel" "ConversationChannel" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'EM_ANALISE',
    "leadValue" DECIMAL(10,2),
    "aiReason" TEXT,
    "nextAction" TEXT,
    "tone" TEXT,
    "preview" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "text" TEXT NOT NULL,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "align" TEXT DEFAULT 'left',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTagLink" (
    "conversationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ConversationTagLink_pkey" PRIMARY KEY ("conversationId","tagId")
);

-- CreateTable
CREATE TABLE "CustomerTagLink" (
    "customerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CustomerTagLink_pkey" PRIMARY KEY ("customerId","tagId")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconName" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'ONLINE',
    "description" TEXT,
    "instructions" TEXT,
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "document" TEXT,
    "city" TEXT,
    "stage" "CustomerStage" NOT NULL DEFAULT 'QUALIFICACAO',
    "status" "CustomerStatus" NOT NULL DEFAULT 'EM_ANALISE',
    "source" "LeadSource",
    "segment" TEXT,
    "value" DECIMAL(12,2),
    "lifetimeValue" DECIMAL(12,2),
    "lastContactAt" TIMESTAMP(3),
    "aiScore" INTEGER,
    "aiSentiment" "Sentiment",
    "aiRisk" "RiskLevel",
    "aiNextBestAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProduct" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ATIVO',
    "price" DECIMAL(10,2),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAttendant" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "CustomerAttendant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerChatHistory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "topic" TEXT,
    "sentiment" "ChatSentiment" NOT NULL DEFAULT 'NEUTRO',

    CONSTRAINT "CustomerChatHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAIFinding" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "CustomerAIFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTeam" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "managerId" TEXT,
    "name" TEXT NOT NULL,
    "targetValue" DECIMAL(14,2),
    "pipelineValue" DECIMAL(14,2),
    "conversionRate" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "revenueValue" DECIMAL(14,2),

    CONSTRAINT "SalesTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTeamChannel" (
    "teamId" TEXT NOT NULL,
    "channel" "ConversationChannel" NOT NULL,

    CONSTRAINT "SalesTeamChannel_pkey" PRIMARY KEY ("teamId","channel")
);

-- CreateTable
CREATE TABLE "KanbanBoard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanColumn" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT DEFAULT '#e5e7eb',

    CONSTRAINT "KanbanColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanCard" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "customerId" TEXT,
    "initials" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "score" TEXT,
    "priority" "KanbanPriority" NOT NULL DEFAULT 'MEDIA',
    "dots" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'RASCUNHO',
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowNode" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "agentId" TEXT,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "type" "FlowNodeType" NOT NULL,
    "body" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowBranch" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "targetNodeId" TEXT,

    CONSTRAINT "FlowBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" TEXT,
    "value" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentCustomer" (
    "segmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "SegmentCustomer_pkey" PRIMARY KEY ("segmentId","customerId")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "segmentId" TEXT,
    "name" TEXT NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'RASCUNHO',
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "segmentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'PLANEJADA',
    "budget" DECIMAL(14,2),
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'DESCONECTADO',
    "details" TEXT,
    "config" JSONB,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT,
    "conversationName" TEXT,
    "score" INTEGER,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'BAIXO',
    "recommendation" TEXT,
    "sentiment" "Sentiment" NOT NULL DEFAULT 'NEUTRO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAuditFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "AIAuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "change" TEXT,
    "period" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE INDEX "PlanFeature_planId_idx" ON "PlanFeature"("planId");

-- CreateIndex
CREATE INDEX "PlanExtra_planId_idx" ON "PlanExtra"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_planId_idx" ON "Company"("planId");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_role_idx" ON "User"("companyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_companyId_key" ON "User"("email", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "Conversation_companyId_idx" ON "Conversation"("companyId");

-- CreateIndex
CREATE INDEX "Conversation_customerId_idx" ON "Conversation"("customerId");

-- CreateIndex
CREATE INDEX "Conversation_companyId_status_idx" ON "Conversation"("companyId", "status");

-- CreateIndex
CREATE INDEX "Conversation_companyId_channel_idx" ON "Conversation"("companyId", "channel");

-- CreateIndex
CREATE INDEX "Conversation_agentId_idx" ON "Conversation"("agentId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Tag_companyId_idx" ON "Tag"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_companyId_name_key" ON "Tag"("companyId", "name");

-- CreateIndex
CREATE INDEX "Agent_companyId_idx" ON "Agent"("companyId");

-- CreateIndex
CREATE INDEX "Agent_companyId_status_idx" ON "Agent"("companyId", "status");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE INDEX "Customer_companyId_status_idx" ON "Customer"("companyId", "status");

-- CreateIndex
CREATE INDEX "Customer_companyId_stage_idx" ON "Customer"("companyId", "stage");

-- CreateIndex
CREATE INDEX "Customer_ownerId_idx" ON "Customer"("ownerId");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "CustomerProduct_customerId_idx" ON "CustomerProduct"("customerId");

-- CreateIndex
CREATE INDEX "CustomerAttendant_customerId_idx" ON "CustomerAttendant"("customerId");

-- CreateIndex
CREATE INDEX "CustomerAttendant_userId_idx" ON "CustomerAttendant"("userId");

-- CreateIndex
CREATE INDEX "CustomerChatHistory_customerId_idx" ON "CustomerChatHistory"("customerId");

-- CreateIndex
CREATE INDEX "CustomerChatHistory_customerId_occurredAt_idx" ON "CustomerChatHistory"("customerId", "occurredAt");

-- CreateIndex
CREATE INDEX "CustomerAIFinding_customerId_idx" ON "CustomerAIFinding"("customerId");

-- CreateIndex
CREATE INDEX "SalesTeam_companyId_idx" ON "SalesTeam"("companyId");

-- CreateIndex
CREATE INDEX "SalesTeam_managerId_idx" ON "SalesTeam"("managerId");

-- CreateIndex
CREATE INDEX "SalesTeamMember_teamId_idx" ON "SalesTeamMember"("teamId");

-- CreateIndex
CREATE INDEX "SalesTeamMember_userId_idx" ON "SalesTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTeamMember_teamId_userId_key" ON "SalesTeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "KanbanBoard_companyId_idx" ON "KanbanBoard"("companyId");

-- CreateIndex
CREATE INDEX "KanbanColumn_boardId_idx" ON "KanbanColumn"("boardId");

-- CreateIndex
CREATE INDEX "KanbanCard_columnId_idx" ON "KanbanCard"("columnId");

-- CreateIndex
CREATE INDEX "KanbanCard_customerId_idx" ON "KanbanCard"("customerId");

-- CreateIndex
CREATE INDEX "Workflow_companyId_idx" ON "Workflow"("companyId");

-- CreateIndex
CREATE INDEX "Workflow_companyId_status_idx" ON "Workflow"("companyId", "status");

-- CreateIndex
CREATE INDEX "FlowNode_workflowId_idx" ON "FlowNode"("workflowId");

-- CreateIndex
CREATE INDEX "FlowNode_agentId_idx" ON "FlowNode"("agentId");

-- CreateIndex
CREATE INDEX "FlowBranch_nodeId_idx" ON "FlowBranch"("nodeId");

-- CreateIndex
CREATE INDEX "FlowBranch_targetNodeId_idx" ON "FlowBranch"("targetNodeId");

-- CreateIndex
CREATE INDEX "Segment_companyId_idx" ON "Segment"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_companyId_name_key" ON "Segment"("companyId", "name");

-- CreateIndex
CREATE INDEX "Broadcast_companyId_idx" ON "Broadcast"("companyId");

-- CreateIndex
CREATE INDEX "Broadcast_companyId_status_idx" ON "Broadcast"("companyId", "status");

-- CreateIndex
CREATE INDEX "Broadcast_segmentId_idx" ON "Broadcast"("segmentId");

-- CreateIndex
CREATE INDEX "Campaign_companyId_idx" ON "Campaign"("companyId");

-- CreateIndex
CREATE INDEX "Campaign_companyId_status_idx" ON "Campaign"("companyId", "status");

-- CreateIndex
CREATE INDEX "Campaign_segmentId_idx" ON "Campaign"("segmentId");

-- CreateIndex
CREATE INDEX "Connector_companyId_idx" ON "Connector"("companyId");

-- CreateIndex
CREATE INDEX "Connector_companyId_type_idx" ON "Connector"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Connector_companyId_name_key" ON "Connector"("companyId", "name");

-- CreateIndex
CREATE INDEX "AIAudit_companyId_idx" ON "AIAudit"("companyId");

-- CreateIndex
CREATE INDEX "AIAudit_conversationId_idx" ON "AIAudit"("conversationId");

-- CreateIndex
CREATE INDEX "AIAudit_companyId_riskLevel_idx" ON "AIAudit"("companyId", "riskLevel");

-- CreateIndex
CREATE INDEX "AIAuditFinding_auditId_idx" ON "AIAuditFinding"("auditId");

-- CreateIndex
CREATE INDEX "Metric_companyId_idx" ON "Metric"("companyId");

-- CreateIndex
CREATE INDEX "Metric_companyId_label_idx" ON "Metric"("companyId", "label");

-- CreateIndex
CREATE INDEX "Metric_companyId_period_idx" ON "Metric"("companyId", "period");

-- AddForeignKey
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanExtra" ADD CONSTRAINT "PlanExtra_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTagLink" ADD CONSTRAINT "ConversationTagLink_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTagLink" ADD CONSTRAINT "ConversationTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTagLink" ADD CONSTRAINT "CustomerTagLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTagLink" ADD CONSTRAINT "CustomerTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProduct" ADD CONSTRAINT "CustomerProduct_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAttendant" ADD CONSTRAINT "CustomerAttendant_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAttendant" ADD CONSTRAINT "CustomerAttendant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerChatHistory" ADD CONSTRAINT "CustomerChatHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAIFinding" ADD CONSTRAINT "CustomerAIFinding_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeam" ADD CONSTRAINT "SalesTeam_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeam" ADD CONSTRAINT "SalesTeam_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeamMember" ADD CONSTRAINT "SalesTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SalesTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeamMember" ADD CONSTRAINT "SalesTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeamChannel" ADD CONSTRAINT "SalesTeamChannel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SalesTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanBoard" ADD CONSTRAINT "KanbanBoard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanColumn" ADD CONSTRAINT "KanbanColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "KanbanBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanCard" ADD CONSTRAINT "KanbanCard_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "KanbanColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanCard" ADD CONSTRAINT "KanbanCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowBranch" ADD CONSTRAINT "FlowBranch_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FlowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowBranch" ADD CONSTRAINT "FlowBranch_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "FlowNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentCustomer" ADD CONSTRAINT "SegmentCustomer_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentCustomer" ADD CONSTRAINT "SegmentCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAudit" ADD CONSTRAINT "AIAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAudit" ADD CONSTRAINT "AIAudit_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAuditFinding" ADD CONSTRAINT "AIAuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AIAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
