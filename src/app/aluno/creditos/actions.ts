"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { enviarEmailEntregaPremio } from "@/lib/creditos/entrega-premio";

// As duas functions (resgatar_curso_bonus/resgatar_premio_fisico) já
// levantam mensagens em português pensadas pra aparecer direto pro
// aluno ("Créditos insuficientes...", "Você já atingiu o limite...") —
// diferente do padrão genérico usado em outras actions, aqui repassar o
// texto da exceção é a experiência certa: o aluno precisa saber POR QUE
// o resgate falhou, não só que falhou.

export async function resgatarCursoBonus(cursoId: string): Promise<{ error?: string }> {
  await requireRole("aluno");
  const supabase = await createClient();

  const { error } = await supabase.rpc("resgatar_curso_bonus", { p_curso_id: cursoId });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/aluno/creditos");
  revalidatePath("/aluno");
  return {};
}

export async function resgatarPremioFisico(premioId: string): Promise<{ error?: string }> {
  const user = await requireRole("aluno");
  const supabase = await createClient();

  // Busca os dados do prêmio antes do RPC — resgatar_premio_fisico (Postgres
  // function) não retorna a linha criada em resgates além do próprio id,
  // então é aqui que precisamos capturar nome/custo/config de entrega.
  const { data: premio } = await supabase
    .from("premios")
    .select(
      "nome, custo_creditos, tipo, entrega_email_conteudo, entrega_arquivo_path, entrega_whatsapp_mensagem",
    )
    .eq("id", premioId)
    .single();

  const { data: resgateId, error } = await supabase.rpc("resgatar_premio_fisico", { p_premio_id: premioId });
  if (error) {
    return { error: error.message };
  }

  await dispararEvento(
    "resgate.novo",
    {
      nome_aluno: user.full_name ?? user.email ?? "—",
      nome_premio: premio?.nome ?? "—",
      creditos: premio?.custo_creditos ?? "—",
    },
    `resgate-novo-${premioId}-${user.id}-${Date.now()}`,
  );

  // Fluxo de entrega (TAREFA 12A) — sempre best-effort (nunca deve reverter
  // ou bloquear o resgate, já confirmado com sucesso acima). Roda com o
  // client admin: entregas_premios só tem RLS de escrita para admin (o
  // aluno só enxerga o próprio histórico), então gravar aqui como
  // service_role é o mesmo espírito de processarEvento() em
  // src/lib/automacoes/motor.ts — o registro é dado de operação da escola,
  // não algo que o aluno deva poder alterar depois.
  if (resgateId && premio) {
    try {
      await processarEntregaPremio(resgateId as string, premioId, user, premio);
    } catch {
      // Best-effort — ver comentário acima.
    }
  }

  revalidatePath("/aluno/creditos");
  return {};
}

type PremioParaEntrega = {
  nome: string;
  tipo: string;
  entrega_email_conteudo: string | null;
  entrega_arquivo_path: string | null;
  entrega_whatsapp_mensagem: string | null;
};

async function processarEntregaPremio(
  resgateId: string,
  premioId: string,
  user: { id: string; full_name: string | null; email: string | null },
  premio: PremioParaEntrega,
): Promise<void> {
  const admin = createAdminClient();
  const nomeAluno = user.full_name ?? user.email ?? "—";

  if (premio.tipo === "digital" || premio.tipo === "hibrido") {
    const { data: entrega } = await admin
      .from("entregas_premios")
      .insert({
        resgate_id: resgateId,
        premio_id: premioId,
        aluno_id: user.id,
        tipo_entrega: "email",
        status: "pendente",
      })
      .select("id")
      .single();

    if (entrega && premio.entrega_email_conteudo) {
      await enviarEmailEntregaPremio(admin, entrega.id, premio, user.email, nomeAluno);
    }

    if (premio.entrega_whatsapp_mensagem) {
      await admin.from("entregas_premios").insert({
        resgate_id: resgateId,
        premio_id: premioId,
        aluno_id: user.id,
        tipo_entrega: "whatsapp",
        status: "pendente",
      });

      // WhatsApp real (API Evolution) ainda não está ligado — sempre stub,
      // mesmo padrão de "whatsapp.stub" já usado em matrículas/financeiro.
      await dispararEvento(
        "whatsapp.stub",
        { tipo: "premio_digital", nome_aluno: nomeAluno, nome_premio: premio.nome },
        `whatsapp-stub-premio-${resgateId}`,
      );
    }
  }

  if (premio.tipo === "fisico" || premio.tipo === "hibrido") {
    await admin.from("entregas_premios").insert({
      resgate_id: resgateId,
      premio_id: premioId,
      aluno_id: user.id,
      tipo_entrega: "fisico",
      status: "pendente",
    });
  }
}
