import type { FluxoGatilho } from "./fluxos-tipos";

// Contrato documentado de variáveis por gatilho — verificado contra o objeto `variaveis` real que
// cada chamador de dispararFluxosPorGatilho/executarFluxo monta hoje (ver pontos de disparo em
// src/lib/whatsapp/eventos.ts, src/lib/mensagens/mensagens.ts, src/lib/leads/leads.ts,
// src/lib/gateways/parcelas.ts, src/app/api/webhooks/asaas/route.ts,
// src/app/agendar/[slug]/actions.ts, src/lib/whatsapp/webhook-entrada.ts). Nenhum campo aqui é
// aspiracional — todos vêm de um join que o respectivo chamador já faz, sem query nova.
export const VARIAVEIS_POR_GATILHO: Record<FluxoGatilho, { nome: string; descricao: string }[]> = {
  matricula_criada: [
    { nome: "nome", descricao: "Nome completo do aluno" },
    { nome: "telefone", descricao: "Telefone do aluno" },
    { nome: "curso", descricao: "Nome do curso" },
    { nome: "turma", descricao: "Nome da turma" },
    { nome: "horario", descricao: "Horário das aulas da turma" },
  ],
  agendamento_criado: [
    { nome: "nome", descricao: "Nome do agendado" },
    { nome: "telefone", descricao: "WhatsApp do agendado" },
    { nome: "data", descricao: "Data do agendamento (DD/MM/AAAA)" },
    { nome: "horario", descricao: "Horário do agendamento" },
    { nome: "titulo_pagina", descricao: "Título da página de agendamento" },
  ],
  lead_criado: [
    { nome: "nome", descricao: "Nome do lead" },
    { nome: "telefone", descricao: "Telefone do lead" },
    { nome: "curso", descricao: "Curso de interesse" },
  ],
  pagamento_recebido: [
    { nome: "nome", descricao: "Nome do aluno" },
    { nome: "telefone", descricao: "Telefone do aluno" },
    { nome: "valor", descricao: "Valor pago (ex: R$ 150,00)" },
    { nome: "curso", descricao: "Nome do curso" },
  ],
  cobranca_atrasada: [
    { nome: "nome", descricao: "Nome do aluno" },
    { nome: "telefone", descricao: "Telefone do aluno" },
    { nome: "valor", descricao: "Valor da parcela (ex: R$ 150,00)" },
    { nome: "vencimento", descricao: "Data de vencimento (DD/MM/AAAA)" },
    { nome: "dias_atraso", descricao: "Dias em atraso" },
    { nome: "curso", descricao: "Nome do curso" },
  ],
  primeira_mensagem: [
    { nome: "nome", descricao: "Nome do contato (pushName do WhatsApp)" },
    { nome: "telefone", descricao: "Telefone do contato" },
    { nome: "mensagem", descricao: "Primeira mensagem enviada" },
  ],
  palavra_chave: [
    { nome: "nome", descricao: "Nome do contato" },
    { nome: "telefone", descricao: "Telefone do contato" },
    { nome: "mensagem", descricao: "Mensagem recebida" },
    { nome: "palavra", descricao: "Palavra-chave que disparou o fluxo" },
  ],
  manual: [
    { nome: "nome", descricao: "Nome (valor livre passado ao disparar)" },
    { nome: "telefone", descricao: "Telefone do contato" },
  ],
};
