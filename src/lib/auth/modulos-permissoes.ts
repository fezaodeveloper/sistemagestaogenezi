// Mapa de módulos do painel admin, baseado nos grupos reais de src/components/admin/admin-nav-groups.tsx
// (NavGroup.id/label). "rotas" cobre o prefixo de cada rota do grupo — usado só como referência
// hoje (PARTE 8 da tarefa: aplicar restrição de navegação por módulo é fase futura, ainda não
// bloqueia nada). Mudar o enum admin_modulo no banco (migration 20261106100000_user_permissions.sql)
// exige mudar esta lista também — os ids aqui precisam bater exatamente com os valores do enum.

export const MODULOS_ADMIN = [
  {
    id: "visao_geral",
    label: "Visão Geral",
    rotas: ["/admin", "/admin/pendencias", "/admin/relatorios/academico", "/admin/relatorios/financeiro"],
  },
  {
    id: "matriculas",
    label: "Matrículas",
    rotas: ["/admin/alunos", "/admin/matriculas", "/admin/turmas", "/admin/contratos", "/admin/termos"],
  },
  {
    id: "academico",
    label: "Acadêmico",
    rotas: [
      "/admin/cursos",
      "/admin/cursos-gratuitos",
      "/admin/certificados",
      "/admin/academico",
      "/admin/calendario",
      "/admin/cronograma",
      "/admin/professor",
      "/admin/acesso-remoto",
      "/admin/chat",
    ],
  },
  {
    id: "genezi_conecta",
    label: "Gênezi Conecta",
    rotas: ["/admin/conecta"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    rotas: ["/admin/financeiro"],
  },
  {
    id: "comercial",
    label: "Comercial",
    rotas: ["/admin/comercial", "/admin/leads", "/admin/email-marketing"],
  },
  {
    id: "engajamento",
    label: "Engajamento",
    rotas: ["/admin/premios", "/admin/resgates", "/admin/engajamento"],
  },
  {
    id: "notificacoes",
    label: "Notificações",
    rotas: ["/admin/notificacoes"],
  },
  {
    id: "sistema",
    label: "Sistema",
    rotas: [
      "/admin/automacoes",
      "/admin/mensagens",
      "/admin/whatsapp-fluxos",
      "/admin/whatsapp-mensagens",
      "/admin/contrato",
      "/admin/treinamentos",
      "/admin/api",
      "/admin/configuracoes",
      "/admin/estoque",
      "/admin/manutencao",
      "/admin/fornecedores",
    ],
  },
  {
    id: "legal",
    label: "Legal",
    rotas: ["/admin/legal"],
  },
] as const;

export type AdminModuloId = (typeof MODULOS_ADMIN)[number]["id"];
export const ACOES = ["ler", "editar", "excluir"] as const;
export type AdminAcao = (typeof ACOES)[number];
export const ACAO_LABELS: Record<AdminAcao, string> = { ler: "Ler", editar: "Editar", excluir: "Excluir" };
