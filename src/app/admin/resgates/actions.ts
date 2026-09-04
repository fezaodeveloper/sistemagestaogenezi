"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { enviarEmailEntregaPremio } from "@/lib/creditos/entrega-premio";

export async function marcarResgateEntregue(id: string): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("resgates")
    .update({ status: "entregue", entregue_em: new Date().toISOString(), entregue_por: user.id })
    .eq("id", id)
    .eq("status", "pendente"); // evita marcar de novo algo que já não está mais pendente

  if (error) {
    return { error: "Não foi possível marcar o resgate como entregue." };
  }

  revalidatePath("/admin/resgates");
  return {};
}

// TAREFA 12B — status de entrega (entregas_premios), separado do status
// do resgate em si (resgates.status, tratado por marcarResgateEntregue
// acima). Um resgate 'premio_fisico' pode ter mais de uma linha de
// entrega (ex.: email + whatsapp, se o prêmio for híbrido) — cada ação
// aqui opera numa entrega específica pelo próprio id, não pelo resgate.

export async function marcarEntregaEntregue(
  entregaId: string,
  observacoes: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("entregas_premios")
    .update({
      status: "entregue",
      entregue_em: new Date().toISOString(),
      observacoes: observacoes.trim() || null,
    })
    .eq("id", entregaId);

  if (error) {
    return { error: "Não foi possível marcar a entrega como concluída." };
  }

  revalidatePath("/admin/resgates");
  return {};
}

export async function reenviarEmailEntrega(entregaId: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const admin = createAdminClient();
  const { data: entrega } = await admin
    .from("entregas_premios")
    .select("id, premio_id, aluno_id")
    .eq("id", entregaId)
    .single();

  if (!entrega) {
    return { error: "Entrega não encontrada." };
  }

  const [{ data: premio }, { data: aluno }] = await Promise.all([
    admin
      .from("premios")
      .select("nome, entrega_email_conteudo, entrega_arquivo_path")
      .eq("id", entrega.premio_id)
      .single(),
    admin
      .from("alunos")
      .select("email, profiles!alunos_id_fkey(full_name)")
      .eq("id", entrega.aluno_id)
      .single(),
  ]);

  if (!premio || !aluno) {
    return { error: "Não foi possível carregar os dados para reenviar o email." };
  }

  const nomeAluno =
    (aluno as unknown as { profiles: { full_name: string | null } | null }).profiles?.full_name ??
    aluno.email ??
    "—";

  const resultado = await enviarEmailEntregaPremio(admin, entrega.id, premio, aluno.email, nomeAluno);

  revalidatePath("/admin/resgates");
  return resultado;
}

// WhatsApp real (API Evolution) ainda não está ligado — sempre stub, só
// registra a intenção no log de automações (mesmo padrão já usado em
// matrículas/financeiro/chat).
export async function dispararWhatsappStubEntrega(
  entregaId: string,
  nomeAluno: string,
  nomePremio: string,
): Promise<void> {
  await requireRole("admin");

  await dispararEvento(
    "whatsapp.stub",
    { tipo: "premio_digital", nome_aluno: nomeAluno, nome_premio: nomePremio },
    `whatsapp-stub-entrega-${entregaId}-${Date.now()}`,
  );
}
