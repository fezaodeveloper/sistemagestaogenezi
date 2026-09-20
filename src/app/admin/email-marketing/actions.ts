"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emailConfigurado, enviarEmail } from "@/lib/email/provedor";
import { htmlParaTexto, renderizarTexto } from "@/lib/email/renderizar";
import { anexarRodapeDescadastro, linkDescadastro } from "@/lib/email/descadastro";
import { getDestinatarios, iniciarEnvioCampanha, processarEnvios, type ResultadoProcessamento } from "@/lib/email/marketing";
import { EXEMPLO_CAMPANHA, SEGMENTOS_EMAIL, VARIAVEIS_CAMPANHA } from "@/lib/email/marketing-tipos";

export type DadosCampanhaForm = {
  nome: string;
  assunto: string;
  corpoHtml: string;
  segmento: string;
  // Só vale com segmento "curso_especifico".
  cursoId: string;
};

const dadosSchema = z
  .object({
    nome: z.string().trim().min(1, { error: "Informe o nome da campanha." }).max(150, { error: "O nome pode ter no máximo 150 caracteres." }),
    assunto: z.string().trim().min(1, { error: "Informe o assunto." }).max(300, { error: "Assunto longo demais." }),
    corpoHtml: z.string().trim().min(1, { error: "O corpo do e-mail não pode ficar vazio." }).max(200_000, { error: "Corpo longo demais." }),
    segmento: z.enum(SEGMENTOS_EMAIL, { error: "Escolha o segmento." }),
    cursoId: z.string(),
  })
  .refine((d) => d.segmento !== "curso_especifico" || z.uuid().safeParse(d.cursoId).success, {
    error: "Escolha o curso do segmento.",
    path: ["cursoId"],
  });

const uuid = z.uuid();

function revalidar(id?: string) {
  revalidatePath("/admin/email-marketing");
  if (id) revalidatePath(`/admin/email-marketing/${id}`);
}

// ===== Rascunho =====

export async function salvarCampanha(id: string | null, dadosBrutos: DadosCampanhaForm): Promise<{ id: string } | { error: string }> {
  await requireRole("admin");
  if (id !== null && !uuid.safeParse(id).success) return { error: "Campanha inválida." };

  const parsed = dadosSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const campos = {
    nome: dados.nome,
    assunto: dados.assunto,
    corpo_html: dados.corpoHtml,
    segmento: dados.segmento,
    curso_id: dados.segmento === "curso_especifico" ? dados.cursoId : null,
  };

  const supabase = await createClient();
  if (id === null) {
    const { data, error } = await supabase.from("email_campanhas_marketing").insert(campos).select("id").single();
    if (error || !data) return { error: "Não foi possível salvar a campanha. Confira se a migration email_marketing foi aplicada." };
    revalidar();
    return { id: data.id as string };
  }

  // Só campanhas que ainda não começaram a sair podem ser editadas.
  const { data, error } = await supabase
    .from("email_campanhas_marketing")
    .update(campos)
    .eq("id", id)
    .in("status", ["rascunho", "agendada"])
    .select("id");
  if (error) return { error: "Não foi possível salvar a campanha." };
  if (!data?.length) return { error: "Esta campanha já foi enviada ou cancelada e não pode mais ser editada." };
  revalidar(id);
  return { id };
}

export async function contarDestinatarios(segmento: string, cursoId: string): Promise<{ total: number } | { error: string }> {
  await requireRole("admin");
  const seg = z.enum(SEGMENTOS_EMAIL).safeParse(segmento);
  if (!seg.success) return { error: "Segmento inválido." };
  if (seg.data === "curso_especifico" && !uuid.safeParse(cursoId).success) return { total: 0 };
  try {
    return { total: (await getDestinatarios(seg.data, cursoId || null)).length };
  } catch {
    return { error: "Não foi possível contar os destinatários." };
  }
}

export async function enviarTesteCampanha(assunto: string, corpoHtml: string, destinatario: string): Promise<{ ok: boolean; erro?: string }> {
  await requireRole("admin");
  if (!z.email().safeParse(destinatario.trim()).success) return { ok: false, erro: "Informe um e-mail de destino válido." };
  if (!assunto.trim() || !corpoHtml.trim()) return { ok: false, erro: "Assunto e corpo não podem ficar vazios." };
  if (!(await emailConfigurado())) return { ok: false, erro: "O provedor de e-mail não está configurado." };

  // Igual ao envio real: com o rodapé de descadastro (o link vale pra este endereço).
  const link = linkDescadastro(destinatario.trim());
  const html = anexarRodapeDescadastro(renderizarTexto(corpoHtml, EXEMPLO_CAMPANHA, VARIAVEIS_CAMPANHA, { escapar: true }), link);
  const r = await enviarEmail({
    para: destinatario.trim(),
    headers: { "List-Unsubscribe": `<${link}>` },
    assunto: `[TESTE] ${renderizarTexto(assunto, EXEMPLO_CAMPANHA, VARIAVEIS_CAMPANHA, { escapar: false })}`,
    html,
    texto: htmlParaTexto(html),
  });
  return r.ok ? { ok: true } : { ok: false, erro: r.erro ?? "Não foi possível enviar." };
}

// ===== Envio =====

// "Enviar agora": congela os destinatários e começa a enviar EM SEGUNDO PLANO (a resposta
// volta na hora). O que não couber no tempo desta execução continua pela tela de
// detalhes (que segue enviando enquanto está aberta) ou pelo cron diário.
export async function enviarCampanhaAgora(id: string): Promise<{ total: number } | { error: string }> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Campanha inválida." };

  const inicio = await iniciarEnvioCampanha(id);
  if (!inicio.ok) return { error: inicio.erro };

  after(async () => {
    try {
      await processarEnvios(id);
    } catch (erro) {
      console.error(`[email-marketing] falha ao enviar a campanha ${id}`, erro);
    }
  });
  revalidar(id);
  return { total: inicio.total };
}

// A tela de detalhes chama isto em sequência enquanto houver pendentes.
export async function continuarEnvio(id: string): Promise<ResultadoProcessamento | { error: string }> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Campanha inválida." };
  try {
    const resultado = await processarEnvios(id);
    revalidar(id);
    return resultado;
  } catch {
    return { error: "Falha ao continuar o envio." };
  }
}

// "Agendar": o cron diário dispara as campanhas cuja hora já passou. O horário digitado é
// de Brasília (America/Sao_Paulo, UTC-3 o ano todo desde 2019).
export async function agendarCampanha(id: string, dataHoraLocal: string): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Campanha inválida." };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dataHoraLocal)) return { error: "Informe a data e a hora do envio." };

  const quando = new Date(`${dataHoraLocal}:00-03:00`);
  if (Number.isNaN(quando.getTime())) return { error: "Data inválida." };
  if (quando.getTime() < Date.now() + 60_000) return { error: "Escolha um horário no futuro." };

  const supabase = await createClient();
  const { data: campanha } = await supabase.from("email_campanhas_marketing").select("assunto, corpo_html").eq("id", id).maybeSingle();
  if (!campanha?.assunto?.trim() || !campanha.corpo_html?.trim()) return { error: "Salve a campanha com assunto e corpo antes de agendar." };
  if (!(await emailConfigurado())) return { error: "O provedor de e-mail não está configurado (Configurações > E-mail)." };

  const { data, error } = await supabase
    .from("email_campanhas_marketing")
    .update({ status: "agendada", agendada_para: quando.toISOString() })
    .eq("id", id)
    .in("status", ["rascunho", "agendada"])
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível agendar (a campanha já foi enviada ou cancelada?)." };

  revalidar(id);
  return {};
}

// Agendada -> volta a rascunho (editável).
export async function desagendarCampanha(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Campanha inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_campanhas_marketing")
    .update({ status: "rascunho", agendada_para: null })
    .eq("id", id)
    .eq("status", "agendada")
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível cancelar o agendamento." };

  revalidar(id);
  return {};
}

// Para de enviar: quem já recebeu recebeu; os pendentes ficam sem enviar.
export async function cancelarCampanha(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Campanha inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_campanhas_marketing")
    .update({ status: "cancelada" })
    .eq("id", id)
    .in("status", ["agendada", "enviando"])
    .select("id");
  if (error || !data?.length) return { error: "Só campanhas agendadas ou em envio podem ser canceladas." };

  revalidar(id);
  return {};
}

// Cópia como rascunho (novo público, mesma mensagem).
export async function duplicarCampanha(id: string): Promise<{ id: string } | { error: string }> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Campanha inválida." };

  const supabase = await createClient();
  const { data: original } = await supabase
    .from("email_campanhas_marketing")
    .select("nome, assunto, corpo_html, segmento, curso_id")
    .eq("id", id)
    .maybeSingle();
  if (!original) return { error: "Campanha não encontrada." };

  const { data, error } = await supabase
    .from("email_campanhas_marketing")
    .insert({ ...original, nome: `${String(original.nome).slice(0, 140)} (cópia)` })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível duplicar a campanha." };

  revalidar();
  return { id: data.id as string };
}

// Os envios (histórico por destinatário) vão junto por ON DELETE CASCADE.
export async function excluirCampanha(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Campanha inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("email_campanhas_marketing").delete().eq("id", id).neq("status", "enviando").select("id");
  if (error || !data?.length) return { error: "Não foi possível excluir. Campanhas em envio precisam ser canceladas antes." };

  revalidar();
  return {};
}
