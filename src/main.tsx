import React from "react"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import "./index.css"

import AppLayout from "@/layouts/AppLayout"
import { installAuthFetchInterceptor } from "@/lib/auth"
import { TeamProvider } from "@/contexts/TeamContext"
import Login from "./Login"
import Admin from "./Admin"
import LandingPage  from "@/pages/landing/LandingPage"
import LandingVendas from "@/pages/landing/LandingVendas"
import LandingPME    from "@/pages/landing/LandingPME"

import AtendimentoPage  from "@/pages/AtendimentoPage"
import EmailsPage       from "@/pages/EmailsPage"
import SuportePage      from "@/pages/SuportePage"
import QuadrosPage      from "@/pages/QuadrosPage"
import AgentesPage      from "@/pages/AgentesPage"
import RopsPage         from "@/pages/RopsPage"
import KnowledgeBasePage from "@/pages/KnowledgeBasePage"
import SupportCategoriesPage from "@/pages/SupportCategoriesPage"
import SupportSlaPage from "@/pages/SupportSlaPage"
import AutomacoesPage   from "@/pages/AutomacoesPage"
import SegmentacaoPage  from "@/pages/SegmentacaoPage"
import TransmissaoPage  from "@/pages/TransmissaoPage"
import CampanhasPage    from "@/pages/CampanhasPage"
import EmpresasPage     from "@/pages/EmpresasPage"
import ClientesPage     from "@/pages/ClientesPage"
import OrcamentosPage from "@/pages/OrcamentosPage"
import ProdutosPage from "@/pages/ProdutosPage"
import EquipesPage      from "@/pages/EquipesPage"
import DistribuicaoPage from "@/pages/DistribuicaoPage"
import AuditoriasPage   from "@/pages/AuditoriasPage"
import RelatoriosPage   from "@/pages/RelatoriosPage"
import ConfiguracoesPage from "@/pages/ConfiguracoesPage"
import PipelinesPage from "@/pages/PipelinesPage"
import ErrorPage from "@/pages/ErrorPage"

installAuthFetchInterceptor()

const router = createBrowserRouter([
  // Marketing / public routes
  { path: "/",            element: <LandingPage /> },
  { path: "/para-vendas", element: <LandingVendas /> },
  { path: "/pme",         element: <LandingPME /> },

  // Auth routes
  { path: "/login", element: <Login /> },
  { path: "*", element: <ErrorPage /> },
  { path: "/admin/*", element: <Admin /> },

  // Protected app routes — pathless layout wrapper (AppLayout handles its own auth guard)
  {
    element: <AppLayout />,
    children: [
      { path: "atendimento",   element: <AtendimentoPage /> },
      { path: "emails",        element: <EmailsPage /> },
      { path: "suporte",       element: <SuportePage /> },
      { path: "suporte-categorias", element: <SupportCategoriesPage /> },
      { path: "suporte-sla",   element: <SupportSlaPage /> },
      { path: "quadros",       element: <QuadrosPage /> },
      { path: "pipelines",     element: <PipelinesPage /> },
      { path: "agentes",       element: <AgentesPage /> },
      { path: "rops",          element: <RopsPage /> },
      { path: "base-conhecimento", element: <KnowledgeBasePage /> },
      { path: "automacoes",    element: <AutomacoesPage /> },
      { path: "segmentacao",   element: <SegmentacaoPage /> },
      { path: "transmissao",   element: <TransmissaoPage /> },
      { path: "campanhas",     element: <CampanhasPage /> },
      { path: "empresas",      element: <EmpresasPage /> },
      { path: "clientes",      element: <ClientesPage /> },
      { path: "orcamentos",          element: <OrcamentosPage /> },
      { path: "produtos",            element: <ProdutosPage /> },
      { path: "equipes",       element: <EquipesPage /> },
      { path: "distribuicao",  element: <DistribuicaoPage /> },
      { path: "auditorias",    element: <AuditoriasPage /> },
      { path: "relatorios",    element: <RelatoriosPage /> },
      { path: "configuracoes", element: <ConfiguracoesPage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TeamProvider>
      <RouterProvider router={router} />
    </TeamProvider>
  </React.StrictMode>,
)
