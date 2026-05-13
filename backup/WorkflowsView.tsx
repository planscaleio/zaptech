// Backup do WorkflowsView — removido em 2026-05-12
// Pode ser restaurado no futuro. A view era exposta via src/pages/WorkflowsPage.tsx
// e renderizada em /workflows pelo react-router.

import { GitBranch } from "lucide-react"

// Dados mockados
const workflows = [
  ["Lead novo qualificado", "CRM -> IA -> Equipe", "Ativo", "2.184 execuções"],
  ["Proposta sem resposta", "Pipeline -> WhatsApp", "Ativo", "482 execuções"],
  ["Cliente com risco", "Auditoria IA -> Gestor", "Pausado", "38 alertas"],
]

// Para restaurar: re-adicionar OperationsListView como dependência de App.tsx
export function WorkflowsView() {
  return (
    <OperationsListView
      icon={GitBranch}
      title="Workflows operacionais"
      description="Automações entre canais, IA, equipes, quadros e conectores"
      headers={["Workflow", "Fluxo", "Status", "Volume"]}
      rows={workflows}
      sideTitle="Orquestração"
      sideDescription="Regras de execução, fallback e auditoria"
      sideItems={[
        ["Gatilhos ativos", "12"],
        ["Execuções hoje", "3.102"],
        ["Fallback humano", "Ativo"],
        ["Auditoria IA", "Obrigatória em fluxos críticos"],
      ]}
      expectedResult="Workflow gerado: se lead pedir preço e ficar 2h sem resposta, enviar follow-up, marcar #risco-sla e avisar gestor."
      action="Abrir construtor"
    />
  )
}
