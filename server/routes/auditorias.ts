import { Router, type Request, type Response } from "express"
import { db } from "../db.js"

const router = Router()

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? "gemma4:latest"

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
  const data = await res.json() as { response: string }
  return data.response.trim()
}

// ─── JSON Schemas ─────────────────────────────────────────────────────────────

const SUGGESTIONS_SCHEMA = `"suggestions": [
    {
      "title": "<título da ação — máx 6 palavras>",
      "description": "<o que fazer exatamente, em 1-2 frases>",
      "timeframe": "imediato" ou "esta semana" ou "este mês",
      "impact": "alto" ou "médio"
    }
  ],
  "suggestionsSummary": "<2-3 frases resumindo o caminho de desenvolvimento prioritário>"`

const SOFT_SCHEMA = `{
  "score": <inteiro de 0 a 100>,
  "sentiment": "POSITIVO" ou "NEUTRO" ou "NEGATIVO",
  "riskLevel": "BAIXO" ou "MEDIO" ou "ALTO" ou "CRITICO",
  "recommendation": "<coaching direto ao atendente — 2 a 4 frases usando 'você', citando comportamento específico observado na conversa>",
  "strengths": ["<comportamento positivo observado 1>", "<comportamento positivo 2>"],
  "gaps": ["<lacuna concreta e observada 1>", "<lacuna 2>"],
  "findings": ["<insight comportamental específico 1>", "<insight 2>", "<insight 3>"],
  ${SUGGESTIONS_SCHEMA}
}`

const TECH_SCHEMA = `{
  "score": <inteiro de 0 a 100>,
  "sentiment": "POSITIVO" ou "NEUTRO" ou "NEGATIVO",
  "riskLevel": "BAIXO" ou "MEDIO" ou "ALTO" ou "CRITICO",
  "recommendation": "<ação específica recomendada — 1 a 3 frases>",
  "findings": ["<observação objetiva 1>", "<observação 2>", "<observação 3>"],
  ${SUGGESTIONS_SCHEMA}
}`

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildComunicacaoPrompt(customerName: string, transcript: string): string {
  return `Você é um coach especializado em comunicação interpessoal e vendas consultivas. Sua análise deve ser precisa, baseada em evidências da conversa, e acionável.

OBJETO DA ANÁLISE: comportamento comunicativo do ATENDENTE (ignore o que o cliente disse — analise apenas como o atendente se expressou).
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS — pontue cada critério de 0 a 100, depois calcule a média ponderada como score final:

1. CLAREZA (peso 2): Frases curtas e objetivas? Evita ambiguidades e jargões? Cada mensagem tem um único propósito claro?
   → 90+ = toda mensagem é clara e direta | 70+ = leve excesso de palavras | 50+ = redundâncias frequentes | <50 = mensagens confusas

2. ESCUTA ATIVA (peso 2): O atendente referencia o que o cliente disse antes de responder? Faz perguntas de confirmação? Evita respostas genéricas?
   → 90+ = sempre conecta resposta ao que o cliente disse | 70+ = referencia parcialmente | 50+ = respostas desconectadas às vezes | <50 = ignora o que o cliente disse

3. EMPATIA (peso 2): Tom acolhedor? Usa o nome do cliente? Reconhece o estado emocional do cliente antes de resolver?
   → 90+ = empático com naturalidade e personalização | 70+ = cordial mas formal | 50+ = neutro sem personalização | <50 = frio ou impessoal

4. ASSERTIVIDADE (peso 1.5): Direto sem ser rude? Mantém posição quando necessário? Não cede desnecessariamente?
   → 90+ = firme e respeitoso | 70+ = assertivo na maioria | 50+ = vacila em algumas situações | <50 = passivo ou agressivo

5. RESPONSABILIDADE PESSOAL (peso 1): Usa "eu faço" em vez de "a empresa vai fazer"? Assume ownership dos problemas?
   → 90+ = sempre fala em 1ª pessoa | 70+ = frequentemente | <50 = terceiriza responsabilidade

6. ADAPTAÇÃO AO CANAL (peso 1.5): Escrita adequada para mensagem de texto? Parágrafos curtos? Sem erros grotescos?
   → 90+ = ideal para o canal | 70+ = boa adaptação | <50 = texto longo ou inapropriado para o canal

REGRAS DO SCORE FINAL:
- BAIXO: se qualquer critério individual for < 40, penalize o score total em -10 pontos
- CRITICO: score < 30 = riskLevel CRITICO, 30-49 = ALTO, 50-74 = MEDIO, 75+ = BAIXO

CAMPO "recommendation": cite um trecho ESPECÍFICO da conversa que ilustra o maior ponto de desenvolvimento. Comece com "Na mensagem onde você..." ou "Quando você escreveu...". Use 'você', não "o atendente".

CAMPO "strengths": liste apenas comportamentos OBSERVADOS na conversa, não comportamentos esperados. Máx 3.
CAMPO "gaps": liste apenas lacunas COM EVIDÊNCIA na conversa. Máx 3.
CAMPO "findings": 3 insights analíticos — 1 sobre padrão positivo, 1 sobre padrão de melhoria, 1 sobre impacto no cliente.
CAMPO "suggestions": 3-4 ações práticas, ordenadas por impacto decrescente. Cada uma deve ser praticável no próximo atendimento.

Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois:
${SOFT_SCHEMA}`
}

function buildIEPrompt(customerName: string, transcript: string): string {
  return `Você é um coach de desenvolvimento comportamental especializado em inteligência emocional (modelo Goleman: autoconsciência, autorregulação, motivação, empatia, habilidades sociais).

OBJETO DA ANÁLISE: comportamento emocional do ATENDENTE. Procure evidências textuais — tom, escolha de palavras, reação a provocações.
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS — avalie com base em evidências textuais observáveis:

1. REGULAÇÃO EMOCIONAL (peso 3): Mantém tom profissional quando o cliente está irritado, impaciente ou grosseiro?
   → 90+ = nunca reage emocionalmente, absorve pressão com elegância | 70+ = mantém na maioria | 50+ = leve reatividade visível | <50 = reage visivelmente à pressão

2. PACIÊNCIA (peso 2): Responde com calma a objeções repetidas ou perguntas já respondidas?
   → 90+ = paciente mesmo em loops | 70+ = paciência com leves sinais de frustração | <50 = impaciência visível na linguagem

3. EMPATIA FUNCIONAL (peso 2): Reconhece o estado emocional do cliente ANTES de tentar resolver o problema?
   → 90+ = sempre valida emoção antes da solução | 70+ = às vezes | <50 = vai direto à solução ignorando emoção

4. ADAPTABILIDADE (peso 1.5): Ajusta o tom e a abordagem quando percebe mudança no humor do cliente?
   → 90+ = adapta-se naturalmente | 70+ = adapta com atraso | <50 = tom rígido independente do cliente

5. AUTOCONSCIÊNCIA (peso 1): Há sinais de que percebe o impacto de suas palavras? Corrige tom quando percebe mal-entendido?
   → 90+ = corrige proativamente | 70+ = corrige quando apontado | <50 = não demonstra autoconsciência

6. RESPOSTA A FEEDBACK NEGATIVO (peso 0.5): Reage com abertura ou defensividade quando criticado?
   → 90+ = abre para crítica com gratidão | 70+ = aceita sem reatividade | <50 = defensivo ou justificativo

REGRAS DO SCORE: <40 em regulação emocional = penalizar -15 no score final. riskLevel: <40=CRITICO, 40-59=ALTO, 60-74=MEDIO, 75+=BAIXO

CAMPO "recommendation": cite UM momento específico da conversa onde a IE ficou mais evidente (positiva ou negativa). Conecte o comportamento ao impacto no cliente. Proponha UMA micro-mudança concreta praticável imediatamente. Use "você".

CAMPO "suggestions": cada sugestão deve ser um HÁBITO CONCRETO — algo que o atendente pode fazer diferente no próximo atendimento, não uma diretriz abstrata.

Responda APENAS com JSON válido, sem markdown:
${SOFT_SCHEMA}`
}

function buildConflictoPrompt(customerName: string, transcript: string): string {
  return `Você é especialista em mediação e gestão de conflitos em contextos comerciais B2B/B2C.

OBJETO DA ANÁLISE: como o ATENDENTE gerencia objeções, tensões e desacordos. Se a conversa não tiver conflito aparente, avalie como o atendente PREVENIU conflitos e lide com resistências latentes.
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS:

1. DESESCALONAMENTO (peso 3): Reduz tensão sem ceder posição de valor? Usa "entendo sua preocupação" antes de responder?
   → 90+ = desescalona com habilidade, mantém valor | 70+ = desescalona mas cede posição | <50 = escalona ou ignora a tensão

2. TRATAMENTO DA CAUSA RAIZ (peso 2): Identifica o que REALMENTE incomoda o cliente (nem sempre é o que ele disse)?
   → 90+ = vai à causa raiz | 70+ = trata a objeção mas não a causa | <50 = trata apenas o sintoma

3. POSTURA COLABORATIVA (peso 2): Busca solução conjunta ou defende território?
   → 90+ = "como podemos resolver isso juntos?" | 70+ = colaborativo na maioria | <50 = defensivo ou territorial

4. VALIDAÇÃO ANTES DE CONTRA-ARGUMENTAR (peso 1.5): Reconhece a preocupação antes de responder?
   → 90+ = sempre valida primeiro | 70+ = na maioria | <50 = vai direto ao contra-argumento

5. CONTROLE DO FRAME (peso 1): Mantém a conversa produtiva? Evita que o cliente defina a agenda negativamente?
   → 90+ = sempre redireciona construtivamente | <50 = perde o controle do frame

6. ENCERRAMENTO (peso 0.5): O cliente termina sentindo-se ouvido, mesmo em desfecho negativo?
   → 90+ = cliente se sente respeitado independente do resultado | <50 = cliente termina insatisfeito com o processo

Se a conversa não tiver tensão aparente: avalie como o atendente ANTECIPA e PREVINE conflitos na comunicação.

CAMPO "recommendation": cite o momento de maior tensão da conversa e o que o atendente fez (bem ou mal). Proponha uma técnica específica de mediação (ex: "Técnica do espelho", "Pergunta de clarificação", "Reframe positivo").

Responda APENAS com JSON válido, sem markdown:
${SOFT_SCHEMA}`
}

function buildNegociacaoPrompt(customerName: string, transcript: string): string {
  return `Você é consultor sênior de negociação com 20 anos de experiência em vendas B2B consultivas e metodologias SPIN, Challenger Sale e Harvard.

OBJETO DA ANÁLISE: comportamento negocial do ATENDENTE. Avalie com rigor — negociação de alto nível exige evidências claras de técnica.
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS:

1. ARGUMENTAÇÃO POR VALOR (peso 3): Usa benefícios e resultados para o CLIENTE (não características do produto)?
   → 90+ = cada argumento é sobre impacto no negócio do cliente | 70+ = mistura features e benefícios | <50 = fala mais de características que de valor

2. ANCORAGEM DE VALOR (peso 2): Posiciona o valor ANTES de falar em preço ou condições?
   → 90+ = âncora alta estabelecida claramente | 70+ = âncora parcial | <50 = fala de preço sem construir valor antes

3. PADRÃO DE CONCESSÕES (peso 2): Cede com contrapartida ou cede livremente?
   → 90+ = cada concessão tem contrapartida explícita | 70+ = maioria tem contrapartida | <50 = concede sem pedir nada em troca

4. DESCOBERTA DE INTERESSES REAIS (peso 1.5): Descobre o que o cliente REALMENTE precisa (além do que pediu)?
   → 90+ = identifica motivação real por trás da demanda | 70+ = identifica parcialmente | <50 = responde apenas ao que foi dito

5. CRIAÇÃO DE ALTERNATIVAS (peso 1): Propõe opções em vez de deixar impasse?
   → 90+ = cria alternativas criativas que desbloqueiam a negociação | 70+ = propõe 1-2 opções | <50 = aceita impasse

6. CONDUÇÃO PARA PRÓXIMO PASSO (peso 0.5): Define próximo passo concreto antes de encerrar?
   → 90+ = sempre fecha com ação específica, data e responsável | <50 = conversa termina sem próximo passo claro

Se a conversa não tiver elemento de negociação explícita, avalie oportunidades de negociação perdidas.

CAMPO "recommendation": avalie o estilo de negociação predominante (distributivo/integrativo/acomodativo) e oriente como evoluir para negociação baseada em valor.

CAMPO "suggestions": foque em técnicas específicas de negociação com nome (ex: "Técnica do silêncio após proposta", "BATNA explícita", "Ancoragem por comparação").

Responda APENAS com JSON válido, sem markdown:
${SOFT_SCHEMA}`
}

function buildLiderancaPrompt(customerName: string, transcript: string): string {
  return `Você é coach executivo especializado em desenvolvimento de liderança. Avalia presença executiva em contextos de atendimento comercial — onde liderança se manifesta como influência, ownership e comunicação de visão.

OBJETO DA ANÁLISE: sinais de liderança e postura executiva do ATENDENTE. Um atendente lidera quando inspira confiança, toma decisões com segurança e orienta o cliente.
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS:

1. OWNERSHIP (peso 3): Assume responsabilidade pelos problemas em vez de repassar para "o sistema", "a empresa" ou outros departamentos?
   → 90+ = sempre fala "eu cuido disso" | 70+ = assume na maioria | <50 = terceiriza ou justifica

2. TOMADA DE DECISÃO (peso 2.5): Decide com confiança? Evita respostas vagas como "vou verificar" sem prazo?
   → 90+ = decide no ato ou dá prazo preciso | 70+ = alguns momentos de hesitação | <50 = excesso de verificações e incertezas

3. INFLUÊNCIA POSITIVA (peso 2): Move o cliente por convicção e argumento, não por pressão ou urgência artificial?
   → 90+ = influência genuína baseada em valor | 70+ = influencia com leve pressão ocasional | <50 = pressão ou manipulação visível

4. COMUNICAÇÃO DE VISÃO (peso 1.5): Transmite propósito além da transação imediata? Faz o cliente sentir que faz parte de algo maior?
   → 90+ = conecta produto/serviço ao propósito do cliente | 70+ = menciona contexto estratégico | <50 = puramente transacional

5. ORIENTAÇÃO AO LONGO PRAZO (peso 0.5): Pensa no relacionamento além da venda imediata?
   → 90+ = menciona próximos passos, crescimento conjunto | <50 = foco exclusivo na transação imediata

6. POSTURA EXECUTIVA (peso 0.5): Tom, vocabulário e presença condizentes com um líder?
   → 90+ = linguagem precisa, confiante e profissional | <50 = gírias, incerteza ou postura inferior

CAMPO "recommendation": identifique o traço de liderança mais desenvolvido E o mais crítico para desenvolver. Proponha uma prática de desenvolvimento executivo específica.

CAMPO "suggestions": cada sugestão deve focar em um COMPORTAMENTO OBSERVÁVEL que o atendente pode adotar amanhã, não em conceitos abstratos.

Responda APENAS com JSON válido, sem markdown:
${SOFT_SCHEMA}`
}

function buildQualidadePrompt(customerName: string, transcript: string): string {
  return `Você é auditor especializado em qualidade de atendimento ao cliente. Avalie com rigor técnico baseado em evidências observáveis na conversa.

OBJETO DA ANÁLISE: qualidade do atendimento prestado pelo ATENDENTE.
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS:

1. CLAREZA DAS INFORMAÇÕES (peso 2): As informações fornecidas são precisas, completas e sem ambiguidade?
   → 90+ = informação completa e verificável | 70+ = boa clareza com lacunas menores | <50 = informações incompletas ou imprecisas

2. TOM E CORDIALIDADE (peso 1.5): Tom respeitoso e apropriado ao contexto durante toda a conversa?
   → 90+ = sempre cordial, mesmo sob pressão | 70+ = cordial na maioria | <50 = tom inapropriado em algum momento

3. COMPLETUDE DA RESPOSTA (peso 2): Respondeu TUDO que o cliente perguntou? Não deixou questão sem resposta?
   → 90+ = responde 100% das questões do cliente | 70+ = perde 1-2 pontos menores | <50 = questões importantes sem resposta

4. RESOLUÇÃO NO PRIMEIRO CONTATO (FCR) (peso 2): O problema foi resolvido sem necessidade de retorno ou escalação?
   → 90+ = resolvido no ato | 70+ = resolvido com redirecionamento adequado | <50 = cliente precisa retornar

5. ADERÊNCIA AO PADRÃO (peso 1): Seguiu protocolo de saudação, identificação, resolução e encerramento?
   → 90+ = protocolo completo | 70+ = etapas principais | <50 = protocolo ignorado

6. SATISFAÇÃO PERCEBIDA (peso 1.5): O cliente demonstra satisfação no desfecho?
   → 90+ = satisfação explícita | 70+ = desfecho positivo implícito | <50 = insatisfação ou frustração visível

CAMPO "recommendation": identifique o maior ponto de falha de qualidade e proponha o padrão correto com exemplo.
CAMPO "suggestions": foque em checklists, processos ou ajustes de rotina imediatamente implementáveis.

Responda APENAS com JSON válido, sem markdown:
${TECH_SCHEMA}`
}

function buildComercialPrompt(customerName: string, transcript: string): string {
  return `Você é analista de performance comercial especializado em vendas consultivas. Avalie a eficácia comercial do atendimento com foco em resultados mensuráveis.

OBJETO DA ANÁLISE: performance comercial do ATENDENTE.
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS:

1. IDENTIFICAÇÃO E EXPLORAÇÃO DE OPORTUNIDADE (peso 3): Reconheceu sinais de compra? Explorou o potencial da conversa?
   → 90+ = identificou e explorou ativamente | 70+ = identificou mas explorou parcialmente | <50 = perdeu oportunidade clara

2. TRATAMENTO DE OBJEÇÕES (peso 2.5): Respondeu objeções com argumento de valor ou apenas com desconto/concessão?
   → 90+ = respondeu com valor e evidência | 70+ = respondeu adequadamente | <50 = cedeu sem argumento ou ignorou

3. PROPOSTA DE VALOR APRESENTADA (peso 2): Articulou claramente por que o produto/serviço resolve o problema do cliente?
   → 90+ = proposta clara e específica ao cliente | 70+ = proposta genérica mas adequada | <50 = sem proposta de valor clara

4. PRÓXIMO PASSO DEFINIDO (peso 1.5): Ficou claro o que acontece a seguir? Há data, responsável e ação definidos?
   → 90+ = próximo passo específico e comprometido | 70+ = próximo passo vago | <50 = conversa termina sem próximo passo

5. AVANÇO NO PIPELINE (peso 1): A conversa avançou o cliente no funil comercial?
   → 90+ = avanço claro de estágio | 70+ = avanço parcial | <50 = estagnação ou retrocesso

CAMPO "recommendation": se houve oportunidade perdida, descreva-a com o trecho onde aconteceu e como deveria ter sido tratada.
CAMPO "suggestions": foque em técnicas comerciais específicas (ex: "assumir o fechamento", "escassez legítima", "upsell por necessidade").

Responda APENAS com JSON válido, sem markdown:
${TECH_SCHEMA}`
}

function buildCompliancePrompt(customerName: string, transcript: string): string {
  return `Você é auditor sênior de compliance em atendimento comercial e relações de consumo. Avalie com rigor — compliance é binário em muitos aspectos.

OBJETO DA ANÁLISE: aderência do ATENDENTE às normas de compliance.
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS:

1. PROTEÇÃO DE DADOS E PRIVACIDADE (peso 3): Evitou compartilhar ou solicitar dados fora do processo oficial?
   → 90+ = nenhum dado sensível exposto inadequadamente | 50+ = pequeno desvio sem impacto | <50 = dado sensível exposto ou solicitado fora do protocolo

2. VERACIDADE DAS PROMESSAS (peso 3): Prometeu apenas o que pode ser entregue? Evitou exageros ou promessas implícitas?
   → 90+ = comunicação 100% verificável | 70+ = leve exagero sem comprometimento | <50 = promessa difícil de cumprir ou enganosa

3. ADERÊNCIA À POLÍTICA COMERCIAL (peso 2): Descontos, prazos e condições dentro do permitido?
   → 90+ = total aderência | 70+ = desvio menor com justificativa | <50 = promessa fora da política

4. LINGUAGEM JURIDICAMENTE SEGURA (peso 1.5): Evitou termos que possam gerar interpretação jurídica inadequada (garantias absolutas, "pode processar", etc.)?
   → 90+ = linguagem segura em toda a conversa | <50 = uso de termos que geram risco jurídico

5. RASTREABILIDADE E REGISTRO (peso 0.5): A conversa está documentada de forma que possa ser auditada?
   → 90+ = todos os acordos registrados claramente | <50 = acordos verbais sem registro

CAMPO "recommendation": se houve desvio de compliance, descreva o risco jurídico ou regulatório específico e a ação corretiva.
CAMPO "suggestions": foque em processos de prevenção, scripts seguros e checklists de verificação.

Responda APENAS com JSON válido, sem markdown:
${TECH_SCHEMA}`
}

function buildOperacaoPrompt(customerName: string, transcript: string): string {
  return `Você é especialista em operações de atendimento, gestão de SLA e eficiência operacional.

OBJETO DA ANÁLISE: performance operacional do ATENDENTE.
Cliente: ${customerName}

TRANSCRIÇÃO:
${transcript}

CRITÉRIOS:

1. EFICIÊNCIA NO ATENDIMENTO (peso 3): Resolveu sem desperdício de mensagens? Evitou loops desnecessários?
   → 90+ = conversa direto ao ponto, sem redundâncias | 70+ = leve overhead | <50 = processo lento ou redundante

2. RESOLUÇÃO DEFINITIVA (peso 2.5): Problema foi resolvido de forma que evite reabertura?
   → 90+ = solução completa e verificada com cliente | 70+ = solução parcial adequada | <50 = solução que provavelmente gerará retorno

3. TRANSFERÊNCIAS E ENCAMINHAMENTOS (peso 2): Se houve encaminhamento, foi necessário e bem executado?
   → 90+ = encaminhamento com contexto completo e sem perda de informação | 70+ = encaminhamento adequado | <50 = encaminhamento desnecessário ou mal executado. Se não houve, avaliar se deveria ter havido.

4. GESTÃO DO TEMPO DE RESPOSTA (peso 1.5): Respostas dentro do SLA esperado para o canal?
   → Avalie pelo ritmo da conversa e indicações de tempo se houver

5. ESCALAÇÃO ADEQUADA (peso 1): Soube quando e como escalar? Evitou escalações desnecessárias?
   → 90+ = escalação quando necessário, proativa e com contexto | <50 = escalação evitada quando necessária ou feita sem contexto

CAMPO "recommendation": identifique a maior ineficiência operacional e o processo correto.
CAMPO "suggestions": foque em automações, templates ou checklists operacionais concretos.

Responda APENAS com JSON válido, sem markdown:
${TECH_SCHEMA}`
}

// ─── Dimension registry ───────────────────────────────────────────────────────

type Category = "TECNICA" | "SOFT_SKILLS"

interface DimDef {
  category: Category
  label: string
  buildPrompt: (customerName: string, transcript: string) => string
}

const DIMENSIONS: Record<string, DimDef> = {
  "qualidade":            { category: "TECNICA",     label: "Qualidade",            buildPrompt: buildQualidadePrompt },
  "comercial":            { category: "TECNICA",     label: "Comercial",            buildPrompt: buildComercialPrompt },
  "compliance":           { category: "TECNICA",     label: "Compliance",           buildPrompt: buildCompliancePrompt },
  "operacao":             { category: "TECNICA",     label: "Operação",             buildPrompt: buildOperacaoPrompt },
  "comunicacao":          { category: "SOFT_SKILLS", label: "Comunicação",          buildPrompt: buildComunicacaoPrompt },
  "inteligencia-emocional": { category: "SOFT_SKILLS", label: "Inteligência Emocional", buildPrompt: buildIEPrompt },
  "gestao-conflito":      { category: "SOFT_SKILLS", label: "Gestão de Conflito",   buildPrompt: buildConflictoPrompt },
  "negociacao":           { category: "SOFT_SKILLS", label: "Negociação",           buildPrompt: buildNegociacaoPrompt },
  "lideranca":            { category: "SOFT_SKILLS", label: "Liderança",            buildPrompt: buildLiderancaPrompt },
}

// ─── JSON parser ──────────────────────────────────────────────────────────────

interface SuggestionItem {
  title: string
  description: string
  timeframe: string
  impact: string
}

interface AuditResult {
  score: number
  sentiment: string
  riskLevel: string
  recommendation: string
  strengths?: string[]
  gaps?: string[]
  findings: string[]
  suggestions: SuggestionItem[]
  suggestionsSummary: string
}

function parseOllamaJson(raw: string): AuditResult {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("Resposta sem JSON da IA")
  const p = JSON.parse(match[0])

  const parseSuggestions = (arr: unknown): SuggestionItem[] => {
    if (!Array.isArray(arr)) return []
    return arr
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => ({
        title:       typeof s.title === "string"       ? s.title.trim()       : "",
        description: typeof s.description === "string" ? s.description.trim() : "",
        timeframe:   typeof s.timeframe === "string"   ? s.timeframe.trim()   : "imediato",
        impact:      typeof s.impact === "string"      ? s.impact.trim()      : "médio",
      }))
      .filter((s) => s.title)
  }

  return {
    score:              typeof p.score === "number" ? Math.min(100, Math.max(0, Math.round(p.score))) : 50,
    sentiment:          ["POSITIVO", "NEUTRO", "NEGATIVO"].includes(p.sentiment) ? p.sentiment : "NEUTRO",
    riskLevel:          ["BAIXO", "MEDIO", "ALTO", "CRITICO"].includes(p.riskLevel) ? p.riskLevel : "BAIXO",
    recommendation:     typeof p.recommendation === "string" ? p.recommendation.trim() : "",
    strengths:          Array.isArray(p.strengths) ? p.strengths.filter((s: unknown) => typeof s === "string") : undefined,
    gaps:               Array.isArray(p.gaps)      ? p.gaps.filter((g: unknown) => typeof g === "string")      : undefined,
    findings:           Array.isArray(p.findings)  ? p.findings.filter((f: unknown) => typeof f === "string").slice(0, 10) : [],
    suggestions:        parseSuggestions(p.suggestions),
    suggestionsSummary: typeof p.suggestionsSummary === "string" ? p.suggestionsSummary.trim() : "",
  }
}

// ─── GET /auditorias/stats — deve ficar antes de /:id ─────────────────────────

router.get("/stats", async (req: Request, res: Response) => {
  const { companyId, dateFrom, dateTo } = req.query as Record<string, string>
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" })

  const dateFilter = dateFrom || dateTo ? {
    createdAt: {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    },
  } : {}

  const [byDimension, byRisk, total, avgScore] = await Promise.all([
    db.aIAudit.groupBy({
      by: ["dimension", "category"],
      where: { companyId, dimension: { not: null }, ...dateFilter },
      _avg: { score: true },
      _count: { id: true },
    }),
    db.aIAudit.groupBy({
      by: ["riskLevel"],
      where: { companyId, dimension: { not: null }, ...dateFilter },
      _count: { id: true },
    }),
    db.aIAudit.count({ where: { companyId, dimension: { not: null }, ...dateFilter } }),
    db.aIAudit.aggregate({
      where: { companyId, dimension: { not: null }, score: { not: null }, ...dateFilter },
      _avg: { score: true },
    }),
  ])

  const trend = await db.$queryRaw<{ date: string; avgScore: number }[]>`
    SELECT DATE("createdAt")::text as date, ROUND(AVG(score))::int as "avgScore"
    FROM "AIAudit"
    WHERE "companyId" = ${companyId}
      AND dimension IS NOT NULL
      AND "createdAt" >= NOW() - INTERVAL '30 days'
      AND score IS NOT NULL
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `

  return res.json({ byDimension, byRisk, trend, total, avgScore: avgScore._avg.score })
})

// ─── GET /auditorias ──────────────────────────────────────────────────────────

const ALLOWED_ORDER_BY = ["createdAt", "score", "riskLevel", "dimension"] as const
type AllowedOrderBy = (typeof ALLOWED_ORDER_BY)[number]

router.get("/", async (req: Request, res: Response) => {
  const {
    companyId, category, dimension, attendantId,
    riskLevel, dateFrom, dateTo, search,
    limit = "20", offset = "0",
    orderBy = "createdAt", orderDir = "desc",
  } = req.query as Record<string, string>

  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" })

  const safeOrderBy: AllowedOrderBy = (ALLOWED_ORDER_BY as readonly string[]).includes(orderBy)
    ? (orderBy as AllowedOrderBy)
    : "createdAt"
  const safeOrderDir = orderDir === "asc" ? "asc" : "desc"

  const searchClause = search?.trim()
    ? {
        OR: [
          { conversation: { customer: { name: { contains: search.trim(), mode: "insensitive" as const } } } },
          { attendant:    { name:     { contains: search.trim(), mode: "insensitive" as const } } },
          { conversationName: { contains: search.trim(), mode: "insensitive" as const } },
        ],
      }
    : {}

  const where = {
    companyId,
    dimension: { not: null },
    ...(category    ? { category }    : {}),
    ...(dimension   ? { dimension }   : {}),
    ...(attendantId ? { attendantId } : {}),
    ...(riskLevel   ? { riskLevel }   : {}),
    ...(dateFrom || dateTo ? {
      createdAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
      },
    } : {}),
    ...searchClause,
  }

  const [audits, total] = await Promise.all([
    db.aIAudit.findMany({
      where,
      orderBy: { [safeOrderBy]: safeOrderDir },
      take:    Math.min(Number(limit), 100),
      skip:    Number(offset),
      include: {
        findings: true,
        attendant: { select: { id: true, name: true, avatarUrl: true } },
        conversation: {
          select: {
            id: true, channel: true,
            customer: { select: { name: true } },
          },
        },
      },
    }),
    db.aIAudit.count({ where }),
  ])

  return res.json({ audits: audits.map(separateFindings), total })
})

// ─── POST /auditorias ─────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  const { conversationId, attendantId, teamId, dimension, companyId } = req.body ?? {}

  if ((!conversationId && !attendantId && !teamId) || !dimension || !companyId) {
    return res.status(400).json({
      error: "Informe conversationId, attendantId ou teamId, além de dimension e companyId",
    })
  }

  const dimDef = DIMENSIONS[dimension as string]
  if (!dimDef) {
    return res.status(400).json({ error: `Dimensão inválida: ${dimension}`, valid: Object.keys(DIMENSIONS) })
  }

  // ── Modo: por atendimento ──────────────────────────────────────────────────
  if (conversationId) {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true, companyId: true, attendantId: true,
        customer: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" }, select: { role: true, authorName: true, text: true } },
      },
    })

    if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })
    if (conversation.companyId !== companyId) return res.status(403).json({ error: "Acesso negado" })
    if (conversation.messages.length === 0) return res.status(422).json({ error: "Conversa sem mensagens para analisar" })

    const transcript = conversation.messages
      .map((m) => `[${m.role}] ${m.authorName}: ${m.text}`)
      .join("\n")

    const prompt = dimDef.buildPrompt(conversation.customer?.name ?? "cliente", transcript)
    return persistAudit(res, { prompt, dimDef, dimension, companyId, conversationId, attendantId: conversation.attendantId ?? null })
  }

  // ── Modo: por equipe ────────────────────────────────────────────────────────
  if (teamId) {
    const team = await db.salesTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true, name: true, companyId: true,
        members: { select: { user: { select: { id: true, name: true } } } },
      },
    })
    if (!team) return res.status(404).json({ error: "Equipe não encontrada" })
    if (team.companyId !== companyId) return res.status(403).json({ error: "Acesso negado" })
    if (team.members.length === 0) return res.status(422).json({ error: "Equipe sem membros" })

    const memberIds = team.members.map((m) => m.user.id)
    const memberNameById: Record<string, string> = Object.fromEntries(
      team.members.map((m) => [m.user.id, m.user.name])
    )

    const teamConvs = await db.conversation.findMany({
      where: { attendantId: { in: memberIds }, companyId },
      orderBy: { lastMessageAt: "desc" },
      take: 15,
      select: {
        id: true, attendantId: true,
        customer: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" }, select: { role: true, authorName: true, text: true } },
      },
    })

    const teamConvsWith = teamConvs.filter((c) => c.messages.length > 0)
    if (teamConvsWith.length === 0) {
      return res.status(422).json({ error: "Equipe sem conversas com mensagens para analisar" })
    }

    const teamTranscript = teamConvsWith
      .map((c, i) => {
        const memberName = (c.attendantId ? memberNameById[c.attendantId] : null) ?? "membro"
        return (
          `=== Conversa ${i + 1} — Membro: ${memberName} — Cliente: ${c.customer?.name ?? "desconhecido"} ===\n` +
          c.messages.map((m) => `[${m.role}] ${m.authorName}: ${m.text}`).join("\n")
        )
      })
      .join("\n\n")

    const teamContext = `${teamConvsWith.length} conversa${teamConvsWith.length > 1 ? "s" : ""} de membros da equipe "${team.name}"`
    const teamPrompt = dimDef.buildPrompt(teamContext, teamTranscript)
    return persistAudit(res, {
      prompt: teamPrompt, dimDef, dimension, companyId,
      conversationId: null, attendantId: null,
      overrideName: `${dimDef.label} — Equipe: ${team.name}`,
    })
  }

  // ── Modo: por colaborador ──────────────────────────────────────────────────
  const user = await db.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, companyId: true },
  })
  if (!user) return res.status(404).json({ error: "Colaborador não encontrado" })
  if (user.companyId !== companyId) return res.status(403).json({ error: "Acesso negado" })

  const recentConvs = await db.conversation.findMany({
    where: { attendantId, companyId },
    orderBy: { lastMessageAt: "desc" },
    take: 5,
    select: {
      id: true,
      customer: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { role: true, authorName: true, text: true } },
    },
  })

  const convsWith = recentConvs.filter((c) => c.messages.length > 0)
  if (convsWith.length === 0) {
    return res.status(422).json({ error: "Colaborador sem conversas com mensagens para analisar" })
  }

  const combinedTranscript = convsWith
    .map((c, i) =>
      `=== Conversa ${i + 1} — Cliente: ${c.customer?.name ?? "desconhecido"} ===\n` +
      c.messages.map((m) => `[${m.role}] ${m.authorName}: ${m.text}`).join("\n")
    )
    .join("\n\n")

  const context = `${convsWith.length} conversa${convsWith.length > 1 ? "s" : ""} recentes de ${user.name}`
  const prompt = dimDef.buildPrompt(context, combinedTranscript)
  return persistAudit(res, { prompt, dimDef, dimension, companyId, conversationId: null, attendantId })
})

async function persistAudit(
  res: Response,
  opts: {
    prompt: string
    dimDef: DimDef
    dimension: string
    companyId: string
    conversationId: string | null
    attendantId: string | null
    overrideName?: string
  },
) {
  const { prompt, dimDef, dimension, companyId, conversationId, attendantId, overrideName } = opts

  let result: AuditResult
  try {
    const raw = await callOllama(prompt)
    result = parseOllamaJson(raw)
  } catch (err) {
    console.error("[auditorias] Ollama error:", err)
    return res.status(503).json({
      code: "AI_UNAVAILABLE",
      error: "IA indisponível no momento. Tente novamente em instantes.",
    })
  }

  const allFindings = [
    ...result.findings,
    ...(result.strengths ?? []).map((s) => `[FORCA] ${s}`),
    ...(result.gaps ?? []).map((g) => `[LACUNA] ${g}`),
  ]

  const audit = await db.aIAudit.create({
    data: {
      companyId,
      conversationId,
      conversationName:  overrideName ?? dimDef.label,
      category:          dimDef.category,
      dimension,
      attendantId,
      score:             result.score,
      sentiment:         result.sentiment as "POSITIVO" | "NEUTRO" | "NEGATIVO",
      riskLevel:         result.riskLevel as "BAIXO" | "MEDIO" | "ALTO" | "CRITICO",
      recommendation:    result.recommendation,
      suggestions:       result.suggestions.length > 0 ? result.suggestions : undefined,
      suggestionsSummary: result.suggestionsSummary || undefined,
      findings: { create: allFindings.map((text) => ({ text })) },
    },
    include: {
      findings: true,
      attendant: { select: { id: true, name: true, avatarUrl: true } },
      conversation: { select: { id: true, channel: true, customer: { select: { name: true } } } },
    },
  })

  return res.status(201).json(separateFindings(audit))
}

// ─── GET /auditorias/:id ──────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  const audit = await db.aIAudit.findUnique({
    where: { id: req.params.id },
    include: {
      findings: true,
      attendant: { select: { id: true, name: true, avatarUrl: true } },
      conversation: {
        select: {
          id: true, channel: true,
          customer: { select: { name: true } },
        },
      },
    },
  })

  if (!audit) return res.status(404).json({ error: "Auditoria não encontrada" })
  return res.json(separateFindings(audit))
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function separateFindings(audit: { findings: { id: string; text: string }[]; [key: string]: unknown }) {
  const plain    = audit.findings.filter((f) => !f.text.startsWith("[FORCA]") && !f.text.startsWith("[LACUNA]"))
  const strengths = audit.findings
    .filter((f) => f.text.startsWith("[FORCA]"))
    .map((f) => ({ ...f, text: f.text.replace("[FORCA] ", "") }))
  const gaps = audit.findings
    .filter((f) => f.text.startsWith("[LACUNA]"))
    .map((f) => ({ ...f, text: f.text.replace("[LACUNA] ", "") }))

  return { ...audit, findings: plain, strengths, gaps }
}

export default router
