# Lead Scoring — ZapVendas

## Visão geral

O ZapVendas possui **dois scores independentes** para avaliar a qualidade de um lead. Eles medem coisas diferentes e se complementam.

| Score | Campo | Onde fica | Quem calcula |
|---|---|---|---|
| **Score IA** | `Customer.aiScore` | Perfil do cliente | Modelo de IA (análise de conversas) |
| **Score de Lead CRM** | `KanbanCard.score` | Card no pipeline | Algoritmo determinístico de 7 fatores |

---

## 1. Score IA (`Customer.aiScore`)

Valor inteiro de **0 a 100** gerado pelo modelo de linguagem (Ollama / gemma4) a partir da análise das conversas do cliente. Reflete intenção de compra, sentimento, engajamento e sinais qualitativos extraídos das mensagens.

Campos relacionados no modelo `Customer`:

```prisma
aiScore          Int?
aiSentiment      Sentiment?   // POSITIVO | NEUTRO | NEGATIVO
aiRisk           RiskLevel?   // BAIXO | MEDIO | ALTO | CRITICO
aiNextBestAction String?
```

Este score **não é calculado pelo endpoint de compute-score** — é atualizado separadamente pela camada de IA durante o processamento de conversas.

---

## 2. Score de Lead CRM (`KanbanCard.score`)

Valor inteiro de **0 a 100** calculado sob demanda pelo endpoint:

```
POST /api/pipelines/cards/:cardId/compute-score
```

O resultado é gravado nos campos:

```prisma
score          Int?
scoreBreakdown Json?   // detalhamento por fator
```

### Modelo de 7 fatores

O score é a soma dos 7 fatores abaixo, limitada a 100.

---

### Fator 1 — Posição no pipeline (0–25 pts)

Quanto mais avançado o card no funil, maior a pontuação. Calculado proporcionalmente ao índice da coluna atual em relação ao total de colunas do board.

```
stagePts = round( (índice_da_coluna / (total_colunas - 1)) * 25 )
```

**Exemplos** (pipeline com 5 colunas):

| Coluna | Índice | Pontos |
|---|---|---|
| Prospecção | 0 | 0 |
| Qualificação | 1 | 6 |
| Proposta | 2 | 12 |
| Negociação | 3 | 18 |
| Fechado | 4 | 25 |

---

### Fator 2 — Valor do negócio (0–20 pts)

Baseado no campo `KanbanCard.value` (valor estimado da oportunidade em R$).

| Valor (R$) | Pontos |
|---|---|
| Não preenchido | 0 |
| < 1.000 | 2 |
| 1.000 – 4.999 | 4 |
| 5.000 – 9.999 | 8 |
| 10.000 – 19.999 | 12 |
| 20.000 – 49.999 | 16 |
| ≥ 50.000 | 20 |

---

### Fator 3 — Engajamento em atividades (0–20 pts)

Conta o total de atividades registradas no card (notas, ligações, e-mails, reuniões, tarefas, WhatsApp).

```
actPts = min(20, total_atividades × 3)
```

| Atividades | Pontos |
|---|---|
| 0 | 0 |
| 1 | 3 |
| 2 | 6 |
| 4 | 12 |
| 6 | 18 |
| ≥ 7 | 20 (teto) |

---

### Fator 4 — Recência da última atividade (0–15 pts)

Mede quão recente foi o último contato com o lead.

**Se há atividades registradas:**

| Última atividade | Pontos |
|---|---|
| Hoje ou ontem (≤ 1 dia) | 15 |
| Até 3 dias | 12 |
| Até 7 dias | 8 |
| Até 14 dias | 4 |
| Mais de 14 dias | 1 |

**Se não há atividades (card recém-criado):**

| Criado há | Pontos |
|---|---|
| ≤ 2 dias | 8 |
| 3–7 dias | 4 |
| > 7 dias | 0 |

---

### Fator 5 — Completude do perfil (0–10 pts)

2 pontos para cada campo preenchido no card:

| Campo | Pontos |
|---|---|
| `value` (valor da oportunidade) | +2 |
| `expectedCloseAt` (previsão de fechamento) | +2 |
| `contactName` (nome do contato) | +2 |
| `contactEmail` (e-mail do contato) | +2 |
| `contactPhone` (telefone do contato) | +2 |

---

### Fator 6 — Prioridade manual (0–5 pts)

Definida pelo vendedor no card.

| Prioridade | Pontos |
|---|---|
| BAIXA | 1 |
| MEDIA | 3 |
| ALTA | 5 |

---

### Fator 7 — Score IA do cliente (0–5 pts)

Incorpora o `Customer.aiScore` no cálculo para cruzar o sinal de IA com o score CRM.

```
customerAiPts = round( (aiScore / 100) * 5 )
```

| aiScore | Pontos |
|---|---|
| 0 | 0 |
| 40 | 2 |
| 60 | 3 |
| 80 | 4 |
| 100 | 5 |

---

### Fórmula final

```
score = min(100, stagePts + valuePts + actPts + recencyPts + profilePts + priorityPts + customerAiPts)
```

---

## Classificação do score

| Faixa | Classificação | Cor no sistema |
|---|---|---|
| 0–39 | Frio | Cinza |
| 40–69 | Morno | Âmbar |
| 70–100 | Quente | Verde |

---

## Breakdown gravado

Além do score total, o sistema grava o detalhamento em `KanbanCard.scoreBreakdown` (JSON):

```json
{
  "stagePts": 18,
  "valuePts": 12,
  "actPts": 9,
  "recencyPts": 12,
  "profilePts": 8,
  "priorityPts": 5,
  "customerAiPts": 3,
  "total": 67,
  "computed": "2026-05-07T14:30:00.000Z"
}
```

Este breakdown é exibido na aba **Detalhes** do card no Quadro comercial.

---

## Quando recalcular

O score **não é recalculado automaticamente** — ele é calculado sob demanda. O botão de recálculo está disponível na aba Detalhes do card. Situações que justificam recalcular:

- Card movido para outra coluna
- Nova atividade registrada
- Valor ou previsão de fechamento preenchidos
- Prioridade alterada
- Após análise de IA do cliente atualizar o `aiScore`

---

## Uso na Segmentação

O score de lead CRM está disponível como filtro dinâmico nos segmentos de clientes:

- **Score de lead (CRM)** `≥ X` — clientes que têm ao menos um card em pipeline com score maior ou igual a X
- **Score de lead (CRM)** `≤ X` — idem, menor ou igual

O filtro usa `kanbanCards: { some: { score: { gte/lte: n } } }` no Prisma, ou seja, basta um card do cliente atender ao critério para o cliente entrar no segmento.
