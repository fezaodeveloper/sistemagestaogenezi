import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMinor } from "@/lib/alunos/schema";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";
import { renderTemplate } from "@/lib/whatsapp/render";
import { dispararFluxosPorGatilho } from "@/lib/whatsapp/fluxos";
import { whatsappToggleHabilitado } from "@/lib/whatsapp/verificar-toggle";
// Reaproveitado de propósito (apesar do nome): só busca configuracoes.escola_nome, não tem nada
// de específico de SMS — evita duplicar essa mesma busca aqui.
import { nomeEscolaParaSms } from "@/lib/integrax/modelos";
import { DIA_SEMANA_LABELS } from "@/lib/agendamentos/schema";

// Eventos do sistema que disparam WhatsApp via GênZap. Cada função agenda o envio pra DEPOIS da
// resposta (after) e engole qualquer erro — nunca atrasa nem quebra o fluxo que chamou (mesmo
// padrão de src/lib/integrax/notificacoes.ts). Com o GênZap desligado/desconectado,
// enviarWhatsApp() só registra no console o que SERIA enviado.
//
// FORA DESTE ARQUIVO DE PROPÓSITO — matrícula criada, lembrete de aula e falta em aula: já são
// reais desde a Fase 13 (src/lib/mensagens/mensagens.ts: enviarMensagemMatriculaCriada/
// LembreteAula/Falta), com log em `mensagens_enviadas`, retry e editor próprio. A Fase 2 migrou
// o TEXTO desses 3 templates (+ recontato_lead) pra whatsapp_templates (ver a migration) e
// mensagens.ts passou a ler de lá (ver renderTemplate ali) — mas o CAMINHO de envio continua
// sendo o mesmo já testado, para não duplicar nem arriscar quebrar 4 eventos que já funcionam.
//
// GênZap Fase 3 — fluxos personalizados (src/lib/whatsapp/fluxos.ts): dispararFluxosPorGatilho()
// é chamada APÓS o envio automático de cada evento que tem um gatilho de fluxo correspondente.
// Os 6 gatilhos de fluxo (matricula_criada, agendamento_criado, lead_criado, pagamento_recebido,
// cobranca_atrasada, manual) são um vocabulário MENOR e não coincidem 1:1 com os 13 templates —
// só "cobranca_atrasada" tem uma função só dela aqui embaixo; os outros 4 automáticos
// (matrícula criada, agendamento criado, lead criado, pagamento recebido) já disparam WhatsApp
// em pontos FORA deste arquivo (lib/mensagens/mensagens.ts, lib/leads/leads.ts,
// lib/gateways/parcelas.ts, webhooks/asaas, agendar/[slug]/actions.ts) — a chamada de
// dispararFluxosPorGatilho pra esses 4 fica lá, no ponto real do evento, pelo mesmo motivo.

// Exportada pra ser reaproveitada fora dos eventos automáticos deste arquivo — ex.:
// enviarSenhaAlunoWhatsApp (src/app/admin/alunos/actions.ts), disparada por um clique de botão
// e sujeita ao mesmo delay anti-banimento de enviarWhatsApp().
export function emSegundoPlano(tarefa: () => Promise<void>): void {
  const executar = async () => {
    try {
      await tarefa();
    } catch (erro) {
      console.error("[whatsapp] falha ao preparar mensagem", erro);
    }
  };
  try {
    after(executar);
  } catch {
    void executar();
  }
}

function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "";
}

function dataBR(iso: string | null): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function reais(valor: number): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

// getDay() na string "aaaa-mm-dd" pura (sem hora) usaria o fuso do processo — força meio-dia UTC
// pra nunca virar o dia anterior/seguinte por causa de fuso horário.
function diaDaSemana(dataISO: string): string {
  const dia = new Date(`${dataISO.slice(0, 10)}T12:00:00Z`).getUTCDay();
  return DIA_SEMANA_LABELS[dia]?.toLowerCase() ?? "";
}

const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

function urlPortal(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
}

// ----- Agendamento: lembrete D-1 (cron lembrete-agendamentos) -----

// local/link_gerenciar (fix pós agendamentos 2.4): um lembrete separado de "2h antes" exigiria
// um cron de hora em hora, incompatível com o plano Vercel Hobby (crons só 1x/dia) — eliminado.
// Em vez disso, esses dois dados (que o lembrete de 2h levaria) entraram neste único lembrete
// D-1 que já existia, dentro do mesmo cron diário (ver vercel.json).
export function notificarWhatsappAgendamentoLembrete(agendamentoId: string): Promise<void> {
  return (async () => {
    try {
      if (!(await whatsappToggleHabilitado("wz_lembrete_agendamento"))) return;

      const admin = createAdminClient();
      const { data } = await admin
        .from("agendamentos")
        .select("nome, whatsapp, data_agendada, horario, pagina_id")
        .eq("id", agendamentoId)
        .maybeSingle();
      const agendamento = data as { nome: string; whatsapp: string; data_agendada: string; horario: string; pagina_id: string } | null;
      if (!agendamento?.whatsapp) return;

      // Consulta separada e best-effort: local_atendimento/slug (migration 20261030500000) são
      // colunas novas — se ainda não existirem, local/link_gerenciar saem em branco, mas o
      // lembrete D-1 (que já funciona hoje) continua saindo normalmente.
      let slug = "";
      let local = "";
      try {
        const { data: pagina } = await admin
          .from("agendamento_paginas")
          .select("slug, local_atendimento")
          .eq("id", agendamento.pagina_id)
          .maybeSingle();
        slug = (pagina?.slug as string | undefined) ?? "";
        local = (pagina?.local_atendimento as string | null | undefined) ?? "";
      } catch {
        // Mantém slug/local vazios — ver comentário acima.
      }

      const mensagem = await renderTemplate("agendamento_lembrete", {
        nome: primeiroNome(agendamento.nome) || agendamento.nome,
        data: dataBR(agendamento.data_agendada),
        horario: agendamento.horario,
        dia_semana: diaDaSemana(agendamento.data_agendada),
        local: local || "A confirmar",
        link_gerenciar: slug ? `${urlPortal()}/agendar/${slug}/meu-agendamento/${agendamentoId}` : "",
      });
      await enviarWhatsApp(agendamento.whatsapp, mensagem);
    } catch (erro) {
      console.error("[whatsapp] falha no lembrete de agendamento", erro);
    }
  })();
}

// ----- Agendamento: cancelado / faltou (src/app/admin/comercial/agendamentos/actions.ts) -----
// Fire-and-forget de propósito: disparadas por uma Server Action de clique do admin, não podem
// travar a resposta pelo tempo do delay anti-banimento.

export function notificarWhatsappAgendamentoCancelado(agendamentoId: string, motivo?: string): void {
  emSegundoPlano(async () => {
    if (!(await whatsappToggleHabilitado("wz_agendamento_cancelado"))) return;
    const { data } = await createAdminClient()
      .from("agendamentos")
      .select("nome, whatsapp, data_agendada, horario")
      .eq("id", agendamentoId)
      .maybeSingle();
    const agendamento = data as { nome: string; whatsapp: string; data_agendada: string; horario: string } | null;
    if (!agendamento?.whatsapp) return;

    const mensagem = await renderTemplate("agendamento_cancelado", {
      nome: primeiroNome(agendamento.nome) || agendamento.nome,
      data: dataBR(agendamento.data_agendada),
      horario: agendamento.horario,
      motivo: motivo?.trim() || "",
    });
    await enviarWhatsApp(agendamento.whatsapp, mensagem);
  });
}

export function notificarWhatsappAgendamentoFalta(agendamentoId: string): void {
  emSegundoPlano(async () => {
    if (!(await whatsappToggleHabilitado("wz_agendamento_falta"))) return;
    const { data } = await createAdminClient()
      .from("agendamentos")
      .select("nome, whatsapp, data_agendada, horario")
      .eq("id", agendamentoId)
      .maybeSingle();
    const agendamento = data as { nome: string; whatsapp: string; data_agendada: string; horario: string } | null;
    if (!agendamento?.whatsapp) return;

    const mensagem = await renderTemplate("agendamento_falta", {
      nome: primeiroNome(agendamento.nome) || agendamento.nome,
      data: dataBR(agendamento.data_agendada),
      horario: agendamento.horario,
    });
    await enviarWhatsApp(agendamento.whatsapp, mensagem);
  });
}

// ----- Cobrança: gerada (src/app/admin/financeiro/actions.ts::gerarCobranca) -----
// Fire-and-forget: disparada por uma Server Action de clique do admin.

type LinhaParcelaCobranca = {
  valor: number;
  numero_parcela: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  alunos: { id: string; full_name: string | null; telefone: string | null } | null;
  matriculas: { num_parcelas: number | null; turmas: { cursos: { nome: string } | null } | null } | null;
};

async function carregarParcelaParaCobranca(parcelaId: string): Promise<LinhaParcelaCobranca | null> {
  const { data } = await createAdminClient()
    .from("parcelas")
    .select(
      "valor, numero_parcela, data_vencimento, data_pagamento, asaas_invoice_url, asaas_bank_slip_url, alunos(id, full_name, telefone), matriculas(num_parcelas, turmas(cursos(nome)))",
    )
    .eq("id", parcelaId)
    .maybeSingle();
  return data as unknown as LinhaParcelaCobranca | null;
}

function rotuloParcela(parcela: LinhaParcelaCobranca): string {
  const total = parcela.matriculas?.num_parcelas;
  return total && total > 1 ? `${parcela.numero_parcela}/${total}` : String(parcela.numero_parcela);
}

export function notificarWhatsappCobrancaGerada(parcelaId: string): void {
  emSegundoPlano(async () => {
    if (!(await whatsappToggleHabilitado("wz_cobranca_gerada"))) return;
    const parcela = await carregarParcelaParaCobranca(parcelaId);
    const aluno = parcela?.alunos;
    if (!parcela || !aluno?.telefone) return;

    const curso = parcela.matriculas?.turmas?.cursos?.nome ?? "seu curso";
    // Não há um "código Pix copia-e-cola" separado no sistema — o Pix vem embutido na mesma
    // fatura do boleto (ver notificarEmailCobrancaGerada em src/lib/email/eventos.ts, mesmo
    // critério). O link serve pros dois.
    const link = parcela.asaas_bank_slip_url ?? parcela.asaas_invoice_url ?? "";
    const mensagem = await renderTemplate("cobranca_gerada", {
      nome: primeiroNome(aluno.full_name) || "aluno(a)",
      valor: reais(parcela.valor),
      vencimento: dataBR(parcela.data_vencimento),
      descricao: `Parcela ${rotuloParcela(parcela)} - ${curso}`,
      link_boleto: link,
      codigo_pix: link,
    });
    await enviarWhatsApp(aluno.telefone, mensagem);
  });
}

// ----- Cobrança/comprovante: reenvio manual (botão "Enviar cobrança"/"Enviar comprovante" na
// tela de Financeiro, src/components/admin/financeiro-view.tsx) -----
// Diferente dos eventos automáticos acima: são AWAITABLE (não emSegundoPlano/fire-and-forget)
// de propósito — a Server Action que chama precisa saber se o envio realmente funcionou pra
// mostrar sucesso/erro pro admin, não só "disparei e já volto".

export async function notificarWhatsappEnviarCobrancaManual(
  parcelaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  // Nem "wz_envio_cobranca" nem "wz_cobranca_atrasada" existem entre as colunas reais (ver
  // WHATSAPP_NOTIF_CHAVES em src/lib/configuracoes/schema.ts — a cobrança atrasada é dividida
  // em d1/d3/d7/d15, sem uma chave "geral"). Reaproveita wz_cobranca_gerada: é o toggle mais
  // próximo semanticamente já existente, o mesmo usado por notificarWhatsappCobrancaGerada acima
  // pro envio automático desta mesma mensagem.
  if (!(await whatsappToggleHabilitado("wz_cobranca_gerada"))) {
    return { ok: false, erro: "Notificações de cobrança por WhatsApp estão desativadas em Configurações." };
  }

  const parcela = await carregarParcelaParaCobranca(parcelaId);
  const aluno = parcela?.alunos;
  if (!parcela || !aluno?.telefone) {
    return { ok: false, erro: "Aluno sem telefone cadastrado." };
  }

  const curso = parcela.matriculas?.turmas?.cursos?.nome ?? "seu curso";
  const link = parcela.asaas_bank_slip_url ?? parcela.asaas_invoice_url ?? "";
  const mensagem = await renderTemplate("cobranca_gerada", {
    nome: primeiroNome(aluno.full_name) || "aluno(a)",
    valor: reais(parcela.valor),
    vencimento: dataBR(parcela.data_vencimento),
    descricao: `Parcela ${rotuloParcela(parcela)} - ${curso}`,
    link_boleto: link,
    codigo_pix: link,
  });

  const resultado = await enviarWhatsApp(aluno.telefone, mensagem);
  if (!resultado.ok) return { ok: false, erro: resultado.erro ?? "Falha ao enviar a mensagem." };
  if (!resultado.enviado) return { ok: false, erro: "WhatsApp (GênZap) não está ativo/conectado." };
  return { ok: true };
}

// Cópia da mesma mensagem pro responsável, quando o aluno é menor de idade — mesmo critério já
// aplicado em enviarMensagem() (src/lib/mensagens/mensagens.ts, commit a537cb5). Essa function
// (notificarWhatsappComprovantePagamento) NÃO passa por enviarMensagem() — chama enviarWhatsApp
// direto — então ficou sem a cópia até aqui; replicado como uma function própria em vez de
// extrair um helper compartilhado entre os dois arquivos, já que cada um usa um client de envio
// diferente (enviarWhatsApp daqui vs. o enviarWhatsapp de nível mais baixo em
// src/lib/mensagens/evolution.ts). Best-effort: erro aqui nunca deve afetar o retorno da function
// que já confirmou o envio ao aluno.
async function enviarCopiaComprovanteParaResponsavel(
  alunoId: string,
  nomeAluno: string | null,
  mensagemOriginal: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: aluno } = await admin.from("alunos").select("data_nascimento").eq("id", alunoId).maybeSingle();
    if (!aluno || !isMinor(aluno.data_nascimento)) return;

    const { data: responsavel } = await admin
      .from("responsaveis")
      .select("telefone")
      .eq("aluno_id", alunoId)
      .limit(1)
      .maybeSingle();
    if (!responsavel?.telefone) return;

    await enviarWhatsApp(
      responsavel.telefone,
      `📋 Cópia para responsável de ${nomeAluno ?? "aluno(a)"}:\n\n${mensagemOriginal}`,
    );
  } catch (erro) {
    console.error("[whatsapp] falha ao enviar cópia do comprovante pro responsável", erro);
  }
}

export async function notificarWhatsappComprovantePagamento(
  parcelaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  // Sem toggle dedicado: não existe nenhuma coluna wz_* pra confirmação de pagamento na lista
  // real (ver WHATSAPP_NOTIF_CHAVES) — enviada sempre, por ser uma ação manual e pontual do
  // admin (clique em "Enviar comprovante"), não uma automação recorrente que precise de um
  // interruptor próprio.
  const parcela = await carregarParcelaParaCobranca(parcelaId);
  const aluno = parcela?.alunos;
  if (!parcela || !aluno?.telefone) {
    return { ok: false, erro: "Aluno sem telefone cadastrado." };
  }
  if (!parcela.data_pagamento) {
    return { ok: false, erro: "Esta parcela ainda não tem pagamento confirmado." };
  }

  const curso = parcela.matriculas?.turmas?.cursos?.nome ?? "seu curso";
  const nome = primeiroNome(aluno.full_name) || "aluno(a)";
  const urlRecibo = `${urlPortal()}/api/comprovantes/parcela/${parcelaId}/pdf`;
  const mensagem =
    `✅ Pagamento confirmado! Olá, ${nome}, recebemos o pagamento da parcela ${rotuloParcela(parcela)} ` +
    `do curso ${curso} no valor de ${reais(parcela.valor)} em ${dataBR(parcela.data_pagamento)}.\n\n` +
    `Obrigado pela confiança! 🎓\n\n` +
    `🧾 Baixe seu recibo de pagamento:\n${urlRecibo}`;

  const resultado = await enviarWhatsApp(aluno.telefone, mensagem);
  if (!resultado.ok) return { ok: false, erro: resultado.erro ?? "Falha ao enviar a mensagem." };
  if (!resultado.enviado) return { ok: false, erro: "WhatsApp (GênZap) não está ativo/conectado." };

  await enviarCopiaComprovanteParaResponsavel(aluno.id, aluno.full_name, mensagem);

  return { ok: true };
}

// ----- Aluno sem aula: lembrete manual em massa (botão "Inativos (7 dias)" em /admin/alunos) -----
// AWAITABLE — a Server Action em massa que chama precisa do resultado real de cada envio pra
// contar enviados/erros. Sem toggle dedicado: "wz_aluno_sem_acesso" não existe entre as colunas
// reais (só a versão do Telegram, tg_aluno_sem_acesso, existe — e nunca foi ligada a lógica
// nenhuma, ver src/lib/configuracoes/schema.ts).
export async function notificarWhatsappAlunoSemAula(
  telefone: string,
  nome: string,
): Promise<{ ok: boolean; erro?: string }> {
  const mensagem =
    `Olá, ${primeiroNome(nome) || "aluno(a)"}! 👋 Notamos que faz mais de uma semana que você não ` +
    `acessa suas aulas. Que tal retomar hoje? Acesse o portal e continue de onde parou! 📚`;

  const resultado = await enviarWhatsApp(telefone, mensagem);
  if (!resultado.ok) return { ok: false, erro: resultado.erro ?? "Falha ao enviar a mensagem." };
  if (!resultado.enviado) return { ok: false, erro: "WhatsApp (GênZap) não está ativo/conectado." };
  return { ok: true };
}

// ----- Contrato pendente: lembrete manual em massa (botão "Lembrar pendentes" em /admin/contratos) -----
// Diferente de notificarContratoPendente (Telegram, src/lib/automacoes/handlers/telegram.ts) —
// aquele avisa o ADMIN que existem contratos parados; este manda WhatsApp direto pro ALUNO,
// disparado manualmente. AWAITABLE, mesmo motivo de notificarWhatsappAlunoSemAula acima.
export async function notificarWhatsappContratoPendenteLembrete(
  telefone: string,
  nome: string,
): Promise<{ ok: boolean; erro?: string }> {
  const mensagem =
    `Olá, ${primeiroNome(nome) || "aluno(a)"}! 📝 Seu contrato de matrícula ainda está pendente de ` +
    `assinatura. Acesse o portal do aluno para assinar e garantir seu acesso completo ao curso!`;

  const resultado = await enviarWhatsApp(telefone, mensagem);
  if (!resultado.ok) return { ok: false, erro: resultado.erro ?? "Falha ao enviar a mensagem." };
  if (!resultado.enviado) return { ok: false, erro: "WhatsApp (GênZap) não está ativo/conectado." };
  return { ok: true };
}

// ----- Contrato: reenvio manual (botão "Enviar contrato" — whatsapp-stub.tsx / matriculas-table.tsx
// / contratos-view.tsx, todos via WhatsappStubButton/WhatsappStubDropdown) -----
// AWAITABLE, não emSegundoPlano — mesmo motivo de notificarWhatsappEnviarCobrancaManual acima: o
// botão migrado mostra sucesso/erro reais (não é mais o alert "em breve" otimista de antes), e
// isso exige saber o resultado de verdade antes de responder.

type LinhaContratoWhatsapp = {
  id: string;
  status: string;
  matriculas: {
    alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null;
    turmas: { cursos: { nome: string } | null } | null;
  } | null;
};

export async function notificarWhatsappEnviarContrato(
  matriculaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { data } = await createAdminClient()
    .from("contratos_assinados")
    .select(
      "id, status, matriculas(alunos(telefone, profiles!alunos_id_fkey(full_name)), turmas(cursos(nome)))",
    )
    .eq("matricula_id", matriculaId)
    .maybeSingle();

  const contrato = data as unknown as LinhaContratoWhatsapp | null;
  if (!contrato) {
    return { ok: false, erro: "Nenhum contrato encontrado para esta matrícula." };
  }

  const aluno = contrato.matriculas?.alunos;
  if (!aluno?.telefone) {
    return { ok: false, erro: "Aluno sem telefone cadastrado." };
  }

  // "wz_envio_contrato" não existe entre as colunas reais (ver WHATSAPP_NOTIF_CHAVES em
  // src/lib/configuracoes/schema.ts) — enviado sem gate, como pedido explicitamente na tarefa.
  const nome = primeiroNome(aluno.profiles?.full_name) || "aluno(a)";
  const curso = contrato.matriculas?.turmas?.cursos?.nome ?? "seu curso";
  // Dois links: /contrato/[matriculaId]/assinar (público, sem login — validação por CPF, ver
  // src/app/contrato/[matriculaId]/actions.ts::assinarContratoPorCpf) e a rota pública de PDF
  // cru (só leitura/download, sem assinatura). O fluxo antigo com login (/aluno/contrato)
  // continua existindo e intacto, só não é mais o link enviado por WhatsApp.
  const urlAssinar = `${urlPortal()}/contrato/${matriculaId}/assinar`;
  const urlPdf = `${urlPortal()}/api/contratos/${matriculaId}/pdf`;
  const mensagem =
    `Olá ${nome}! 📄 Seu contrato do curso ${curso} está disponível.\n\n` +
    `✍️ Para ler e assinar digitalmente, acesse sua área do aluno:\n${urlAssinar}\n\n` +
    `📥 Para baixar o PDF diretamente:\n${urlPdf}\n\n` +
    `Qualquer dúvida, estamos à disposição! 😊`;

  const resultado = await enviarWhatsApp(aluno.telefone, mensagem);
  if (!resultado.ok) return { ok: false, erro: resultado.erro ?? "Falha ao enviar a mensagem." };
  if (!resultado.enviado) return { ok: false, erro: "WhatsApp (GênZap) não está ativo/conectado." };
  return { ok: true };
}

// ----- Contrato: aviso ao ADMIN quando o aluno assina digitalmente (/aluno/contrato) -----
// Fire-and-forget de propósito (pedido explícito) — é um aviso complementar ao Telegram que já
// existe (notificarContratoAssinado em src/lib/automacoes/handlers/telegram.ts), não um fluxo
// que alguém espera/precisa confirmar.
//
// "profiles" NÃO tem coluna de telefone (só full_name/avatar_url/avatar_id — telefone é só de
// aluno/responsável). Não existe em lugar nenhum do banco um "telefone do admin" dedicado — o
// único número de telefone de contato da escola salvo é configuracoes.escola_telefone, reaproveitado
// aqui como o destino do aviso (mesmo papel que TELEGRAM_CHAT_ID cumpre do lado do Telegram).
function formatarDataHoraAdmin(iso: string): string {
  const date = new Date(iso);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} ${hora}`;
}

export function notificarWhatsappContratoAssinado(matriculaId: string, alunoId: string): void {
  emSegundoPlano(async () => {
    const admin = createAdminClient();
    const [{ data: alunoData }, { data: matriculaData }, { data: contratoData }, { data: configData }] =
      await Promise.all([
        admin.from("profiles").select("full_name").eq("id", alunoId).maybeSingle(),
        admin.from("matriculas").select("turmas(cursos(nome))").eq("id", matriculaId).maybeSingle(),
        admin.from("contratos_assinados").select("aceito_em").eq("matricula_id", matriculaId).maybeSingle(),
        admin.from("configuracoes").select("escola_telefone").eq("id", true).maybeSingle(),
      ]);

    const telefoneAdmin = configData?.escola_telefone as string | null | undefined;
    if (!telefoneAdmin) return;

    const nomeAluno = (alunoData?.full_name as string | null) ?? "aluno(a)";
    const curso =
      (matriculaData as unknown as { turmas: { cursos: { nome: string } | null } | null } | null)?.turmas?.cursos
        ?.nome ?? "—";
    const aceitoEm = contratoData?.aceito_em as string | null;

    const mensagem =
      `📝 Contrato assinado!\n\n` +
      `👤 Aluno: ${nomeAluno}\n` +
      `📚 Curso: ${curso}\n` +
      `🕐 Assinado em: ${aceitoEm ? formatarDataHoraAdmin(aceitoEm) : "—"}\n\n` +
      `Acesse o painel para visualizar: ${urlPortal()}/admin/contratos`;

    await enviarWhatsApp(telefoneAdmin, mensagem);
  });
}

// ----- Comprovante de matrícula: reenvio manual (botão "Enviar comprovante") -----
// AWAITABLE, não emSegundoPlano — mesmo motivo de notificarWhatsappEnviarContrato acima.

type LinhaMatriculaComprovante = {
  alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null;
  turmas: { cursos: { nome: string } | null } | null;
};

export async function notificarWhatsappEnviarComprovante(
  matriculaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { data } = await createAdminClient()
    .from("matriculas")
    .select("alunos(telefone, profiles!alunos_id_fkey(full_name)), turmas(cursos(nome))")
    .eq("id", matriculaId)
    .maybeSingle();

  const matricula = data as unknown as LinhaMatriculaComprovante | null;
  const aluno = matricula?.alunos;
  if (!matricula || !aluno?.telefone) {
    return { ok: false, erro: "Aluno sem telefone cadastrado." };
  }

  // "wz_envio_comprovante"/equivalente também não existe entre as colunas reais (ver
  // WHATSAPP_NOTIF_CHAVES) — enviado sem gate, mesmo critério de notificarWhatsappEnviarContrato.
  const nome = primeiroNome(aluno.profiles?.full_name) || "aluno(a)";
  const curso = matricula.turmas?.cursos?.nome ?? "seu curso";
  const url = `${urlPortal()}/api/comprovantes/${matriculaId}/pdf`;
  const mensagem =
    `Olá ${nome}! 🎓 Seu comprovante de matrícula do curso ${curso} está disponível:\n\n` +
    `${url}\n\n` +
    `Guarde este documento como confirmação da sua matrícula na Gênezi. Qualquer dúvida, estamos à disposição! 😊`;

  const resultado = await enviarWhatsApp(aluno.telefone, mensagem);
  if (!resultado.ok) return { ok: false, erro: resultado.erro ?? "Falha ao enviar a mensagem." };
  if (!resultado.enviado) return { ok: false, erro: "WhatsApp (GênZap) não está ativo/conectado." };
  return { ok: true };
}

// ----- Cobrança: atrasada, por faixa de dias (cron verificar-atrasos) -----
// Chamada sequencialmente dentro do loop do cron (o delay entre mensagens é o próprio
// comportamento anti-banimento desejado) — por isso é awaitable, não fire-and-forget.

export function diasParaTemplateAtraso(diasAtraso: number): "cobranca_atrasada_d1" | "cobranca_atrasada_d3" | "cobranca_atrasada_d7" | "cobranca_atrasada_d15" {
  if (diasAtraso >= 15) return "cobranca_atrasada_d15";
  if (diasAtraso >= 7) return "cobranca_atrasada_d7";
  if (diasAtraso >= 3) return "cobranca_atrasada_d3";
  return "cobranca_atrasada_d1";
}

export function notificarWhatsappCobrancaAtrasada(parcelaId: string, diasAtraso: number): Promise<void> {
  return (async () => {
    try {
      // Verifica o toggle correto para cada faixa de atraso
      const templateId = diasParaTemplateAtraso(diasAtraso);
      const chaveToggle =
        templateId === "cobranca_atrasada_d15" ? "wz_cobranca_atrasada_d15"
        : templateId === "cobranca_atrasada_d7" ? "wz_cobranca_atrasada_d7"
        : templateId === "cobranca_atrasada_d3" ? "wz_cobranca_atrasada_d3"
        : "wz_cobranca_atrasada_d1";
      if (!(await whatsappToggleHabilitado(chaveToggle))) return;

      const parcela = await carregarParcelaParaCobranca(parcelaId);
      const aluno = parcela?.alunos;
      if (!parcela || !aluno?.telefone) return;

      const link = parcela.asaas_bank_slip_url ?? parcela.asaas_invoice_url ?? "";
      const nome = primeiroNome(aluno.full_name) || "aluno(a)";
      const mensagem = await renderTemplate(templateId, {
        nome,
        valor: reais(parcela.valor),
        vencimento: dataBR(parcela.data_vencimento),
        dias_atraso: String(diasAtraso),
        link_boleto: link,
      });
      await enviarWhatsApp(aluno.telefone, mensagem);

      // Fluxos personalizados (Fase 3) com gatilho "cobranca_atrasada", além do template acima.
      // curso: já vinha no join de carregarParcelaParaCobranca (matriculas.turmas.cursos.nome,
      // ver LinhaParcelaCobranca) — só não entrava no objeto de variáveis até agora.
      await dispararFluxosPorGatilho(
        "cobranca_atrasada",
        {
          telefone: aluno.telefone,
          nome,
          valor: reais(parcela.valor),
          vencimento: dataBR(parcela.data_vencimento),
          dias_atraso: String(diasAtraso),
          curso: parcela.matriculas?.turmas?.cursos?.nome ?? "",
        },
        { tipo: "aluno", id: aluno.id },
      );
    } catch (erro) {
      console.error("[whatsapp] falha na cobrança atrasada", erro);
    }
  })();
}

// ----- Lead: follow-up automático (cron followup-leads) -----
// Awaitable e chamada sequencialmente no loop do cron (mesmo motivo do item anterior).

export function notificarWhatsappLeadFollowup(leadId: string, tentativa: number): Promise<void> {
  return (async () => {
    try {
      if (!(await whatsappToggleHabilitado("wz_followup_lead"))) return;

      const { data } = await createAdminClient().from("leads").select("nome, telefone, cursos(nome)").eq("id", leadId).maybeSingle();
      const lead = data as unknown as { nome: string; telefone: string; cursos: { nome: string } | null } | null;
      if (!lead?.telefone) return;

      const mensagem = await renderTemplate("lead_followup", {
        nome: primeiroNome(lead.nome) || lead.nome,
        curso_interesse: lead.cursos?.nome ?? "nossos cursos",
        nome_escola: await nomeEscolaParaSms(),
        tentativa: String(tentativa),
      });
      await enviarWhatsApp(lead.telefone, mensagem);
    } catch (erro) {
      console.error("[whatsapp] falha no follow-up de lead", erro);
    }
  })();
}

// ----- Dados de acesso da matrícula (botão manual "📱 Dados de acesso") -----
// Continua com mensagem própria (não usa a tabela de templates): é um botão manual e pontual,
// distinto do template "matricula_criada" (que já é o envio AUTOMÁTICO real de
// src/lib/mensagens — ver nota no topo do arquivo). Fire-and-forget de propósito.

export function notificarWhatsappDadosAcesso(matriculaId: string): void {
  emSegundoPlano(async () => {
    if (!(await whatsappToggleHabilitado("wz_dados_acesso"))) return;

    const admin = createAdminClient();
    const { data } = await admin
      .from("matriculas")
      .select("alunos(telefone, email, profiles!alunos_id_fkey(full_name)), turmas(cursos(nome))")
      .eq("id", matriculaId)
      .maybeSingle();

    type Linha = {
      alunos: { telefone: string; email: string | null; profiles: { full_name: string | null } | null } | null;
      turmas: { cursos: { nome: string } | null } | null;
    };
    const matricula = data as unknown as Linha | null;
    const aluno = matricula?.alunos;
    if (!aluno?.telefone) return;

    const nome = primeiroNome(aluno.profiles?.full_name) || "aluno(a)";
    const curso = matricula?.turmas?.cursos?.nome ?? "seu curso";
    const email = aluno.email ?? "o e-mail cadastrado";
    const mensagem = `Olá, ${nome}! 🎓 Aqui estão seus dados de acesso ao curso ${curso}. Acesse a plataforma em ${urlPortal()}/entrar com o e-mail ${email} e a senha cadastrada.`;
    await enviarWhatsApp(aluno.telefone, mensagem);
  });
}
