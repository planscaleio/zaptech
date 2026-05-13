# Workers & Auditoria

## Visão Geral

O sistema possui 8 workers que rodam em background no servidor. Todos os workers usam a infraestrutura de auditoria via `WorkerRun` / `WorkerLog` no banco de dados.

---

## Workers Disponíveis

| Worker | Frequência | Propósito | Batch |
|--------|-----------|-----------|-------|
| `inbound-processor` | 5s | Processa mensagens recebidas do webhook Evolution API → DB | 50 msgs |
| `outbound-sender` | 5s | Envia mensagens da fila → WhatsApp via Evolution API | 20 msgs |
| `outbound-recovery` | 2 min | Detecta mensagens travadas em `PROCESSING` e recoloca na fila | 100 |
| `segment-sync` | 60 min | Reconstrói membros de segmentos por critérios | todos |
| `card-score` | 30 min | Recalcula lead score (0–100) dos cards do kanban | todos |
| `stage-sync` | 60 min | Sincroniza `Customer.stage` com posição no kanban | todos |
| `ai-score` | 24h (~03h) | Roda análise Ollama nos clientes (score, sentimento, risco, next action) | 100 |
| `assignment-recovery` | 10 min | Reatribui conversas sem resposta de atendente por 2h | 100 |

### Detalhes por Worker

#### `inbound-processor`
- Lê `InboundMessage` com status `PENDING`
- Faz upsert de `Customer` + `Conversation`
- Cria histórico de `Message`
- Atribui conversa via regras de distribuição
- Retry: até 5 tentativas com backoff exponencial

#### `outbound-sender`
- Usa `FOR UPDATE SKIP LOCKED` para claiming atômico (evita duplo envio em múltiplas instâncias)
- Envia via `POST /message/sendText/:instanceId` na Evolution API
- Prioridade por campo `priority` ascendente
- Retry: até 5 tentativas com backoff

#### `outbound-recovery`
- Mensagens em `PROCESSING` por mais de 5 minutos são consideradas travadas (crash do servidor)
- Recoloca na fila ou marca como `FAILED` dependendo do número de tentativas

#### `segment-sync`
- Limpa membros existentes (`SegmentCustomer`) e reconstrói do zero
- Interpreta critérios JSON do segmento para montar cláusula WHERE
- Processa todos os segmentos de todas as empresas

#### `card-score`
- 7 fatores ponderados: estágio (25), valor (20), atividade (20), recência (15), perfil (10), prioridade (5), score IA (5)
- Armazena `scoreBreakdown` JSON para rastreabilidade do cálculo

#### `stage-sync`
- Mapeia posição do card no kanban para enum de estágio:
  - Col 0 → PROSPECCAO, 1 → QUALIFICACAO, 2 → DEMONSTRACAO, 3 → PROPOSTA, 4 → NEGOCIACAO, 5+ → FECHADO/POS_VENDA
- Pula atualização se estágio não mudou

#### `ai-score`
- Busca clientes sem score ou com score > 7 dias
- Contexto enviado ao Ollama: 3 últimas conversas (5 msgs cada), produtos, cards + atividades
- Modelo padrão: `gemma4:latest`
- Retorna: `score`, `sentiment`, `risk`, `nextBestAction`, `findings[]`
- Delay de 200ms entre clientes para não sobrecarregar Ollama

#### `assignment-recovery`
- Filtra conversas com atendente atribuído mas sem mensagem de `ATENDENTE`/`AGENTE_IA` nas últimas 2h
- Exclui status encerrados: `ENCERRADO`, `ARQUIVADO`, `PARA_EXCLUIR`, `RESOLVIDO`
- Roda distribuição excluindo o atendente atual

---

## Infraestrutura de Auditoria

### Modelos no Banco (`prisma/schema.prisma`)

#### `WorkerRun` — registro mestre por execução
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | UUID |
| `worker` | string | Nome do worker (ex: `"segment-sync"`) |
| `trigger` | string | `"cron"` \| `"manual"` \| `"event:<nome>"` |
| `status` | enum | `RUNNING` \| `SUCCESS` \| `FAILED` \| `PARTIAL` |
| `companyId` | string? | null = rodou em todas as empresas |
| `startedAt` | DateTime | início da execução |
| `finishedAt` | DateTime? | fim da execução |
| `durationMs` | int? | duração total em ms |
| `itemsTotal` | int | total de itens encontrados |
| `itemsProcessed` | int | itens processados com sucesso |
| `itemsFailed` | int | itens que falharam |
| `meta` | JSON? | contexto de entrada (filtros, ids, etc.) |
| `error` | string? | mensagem de erro se `FAILED` |

#### `WorkerLog` — linhas de log por execução
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | UUID |
| `runId` | string | FK para `WorkerRun` (CASCADE delete) |
| `level` | string | `"info"` \| `"warn"` \| `"error"` |
| `message` | string | texto do log |
| `itemId` | string? | id da entidade relacionada (customerId, cardId…) |
| `detail` | JSON? | dados estruturados extras |
| `createdAt` | DateTime | timestamp |

### Helper `server/workers/runner.ts`

A função `runWorker()` orquestra cada execução:

1. Cria `WorkerRun` com `status=RUNNING`
2. Fornece handle com:
   - `log(level, message, opts?)` — grava em `WorkerLog` + stdout
   - `fail(error)` — marca como `FAILED` e registra `durationMs`
   - `finish(stats)` — marca como `SUCCESS` ou `PARTIAL` (se `failed > 0` e nem tudo processado)

O utilitário `withRetry()` implementa backoff exponencial: `500ms → 1s → 2s → 4s`.

---

## API de Auditoria (Backend)

Todos os endpoints estão em `/server/index.ts`.

### `GET /workers/runs`
Lista execuções com filtros opcionais.

**Query params:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| `worker` | string | filtrar por nome do worker |
| `status` | string | `RUNNING` \| `SUCCESS` \| `FAILED` \| `PARTIAL` |
| `companyId` | string | filtrar por empresa |
| `limit` | number | padrão 50, máximo 200 |

**Resposta:** array de `WorkerRun` (sem logs), ordenado por `startedAt DESC`.

### `GET /workers/runs/:runId`
Retorna execução completa com todos os `WorkerLog` em ordem cronológica.

### `POST /workers/trigger`
Dispara um worker manualmente.

**Body:**
```json
{
  "worker": "segment-sync",
  "companyId": "optional-uuid",
  "meta": {}
}
```

**Resposta:** `{ "runId": "uuid" }`

---

## Painel Administrativo (Pendente)

A API de auditoria está completa, mas **não há UI frontend** para visualizar os logs.

### O que falta construir

Uma página de painel de workers no admin com:

1. **Lista de execuções** (`GET /workers/runs`)
   - Filtros: worker, status, empresa, período
   - Colunas: worker, trigger, status, empresa, início, duração, processados/total/falhas
   - Status com badge colorido (verde=SUCCESS, vermelho=FAILED, amarelo=PARTIAL, azul=RUNNING)

2. **Detalhe de execução** (`GET /workers/runs/:runId`)
   - Header com métricas da execução
   - Timeline de logs com level badge (info/warn/error)
   - Filtro por level
   - Link do `itemId` para navegar até a entidade

3. **Trigger manual** (`POST /workers/trigger`)
   - Select de worker
   - Campo de `companyId` opcional
   - Botão "Disparar agora"
   - Feedback com `runId` gerado

### Sugestão de rota
```
/admin/workers           — lista de execuções com filtros
/admin/workers/:runId    — detalhe de uma execução
```
