// Backup do ConnectorsView — removido em 2026-05-12
// Exposto via src/pages/ConectoresPage.tsx e rota /conectores.

import { Plug } from "lucide-react"

const connectors = [
  ["WhatsApp Business", "Canal", "Conectado", "Último evento há 1 min"],
  ["Instagram Direct", "Canal", "Conectado", "Último evento há 4 min"],
  ["HubSpot CRM", "CRM", "Conectado", "Sincronização em tempo real"],
  ["Webhook Leads", "Entrada", "Ativo", "2.418 eventos hoje"],
  ["Google Calendar", "Agenda", "Revisar", "Permissão expira em 7 dias"],
]

export function ConnectorsView() {
  return (
    <OperationsListView
      icon={Plug}
      title="Conectores"
      description="Canais, CRMs, webhooks e serviços externos ligados à operação"
      headers={["Conector", "Tipo", "Status", "Saúde"]}
      rows={connectors}
      sideTitle="Monitor de integração"
      sideDescription="Eventos, autenticação e falhas recentes"
      sideItems={[
        ["Eventos hoje", "18.492"],
        ["Falhas 24h", "12"],
        ["Latência média", "420ms"],
        ["Próxima revisão", "Google Calendar"],
      ]}
      expectedResult="Diagnóstico: HubSpot saudável, mas Google Calendar precisa renovar escopo de permissão antes de perder criação de reuniões."
      action="Testar conexões"
    />
  )
}
