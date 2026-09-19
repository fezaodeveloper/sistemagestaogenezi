"use server";

import { requireRole } from "@/lib/auth/dal";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import type { LoginBanner } from "@/lib/login-banners/schema";

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export type InteresseCursoResult = { success: true } | { error: string };

// Idempotência por semana (chave inclui aluno + curso + número da semana
// corrente) — evita notificar o Telegram mais de 1x por aluno por curso na
// mesma semana, mesmo que o aluno abra o modal e clique "Tenho interesse!"
// várias vezes.
export async function demonstrarInteresse(cursoId: string, alunoId: string): Promise<InteresseCursoResult> {
  const user = await requireRole("aluno");
  if (user.id !== alunoId) {
    return { error: "Não autorizado." };
  }

  const supabase = await createClient();
  const [{ data: aluno }, { data: curso }] = await Promise.all([
    supabase.from("alunos").select("telefone").eq("id", alunoId).maybeSingle(),
    supabase.from("cursos").select("nome").eq("id", cursoId).maybeSingle(),
  ]);

  const semanaAtual = Math.floor(Date.now() / SEMANA_MS);

  await dispararEvento(
    "interesse.curso",
    {
      nome_aluno: user.full_name ?? user.email ?? "—",
      telefone: aluno?.telefone ?? "—",
      nome_curso: curso?.nome ?? "—",
      curso_id: cursoId,
    },
    `interesse-curso-${alunoId}-${cursoId}-${semanaAtual}`,
  );

  return { success: true };
}

// Sem requireRole redundante de propósito diferente do padrão — aqui é o
// próprio (mesma proteção de getBannersLogin, que roda antes de qualquer
// tela existir): a diferença é que esta é chamada de dentro de /aluno, área
// já protegida, mas o Client Component que a chama (BannerSlideshowPortal)
// não recebe o usuário via prop, então a checagem fica aqui mesmo.
export async function getBannersPortal(): Promise<LoginBanner[]> {
  await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase
    .from("login_banners")
    .select("*")
    .eq("ativo", true)
    .eq("tipo", "portal")
    .order("ordem", { ascending: true });

  return (data as LoginBanner[] | null) ?? [];
}

// ===== Push notifications do próprio aluno (roadmap, item 7 — PWA) =====
//
const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth_key: z.string().min(1).max(200),
});

// APARELHO COMPARTILHADO: o endpoint identifica o navegador/aparelho, não a
// pessoa. Se dois alunos (ou o admin) usam o mesmo aparelho, quem entrou por
// último deve ser quem recebe — então isto é um upsert de verdade por
// endpoint, que troca o aluno_id da linha existente pelo do aluno logado
// (e atualiza as chaves). Isso exige UPDATE, que `authenticated` não tem na
// tabela push_subscriptions (só select/insert/delete) e que a RLS do aluno
// (aluno_id = auth.uid()) também impediria sobre a linha de outra pessoa —
// por isso roda com o client admin (service_role), DEPOIS de requireRole
// ("aluno") e usando sempre o id do usuário autenticado (nunca um id vindo do
// cliente).
export async function salvarPushSubscriptionAluno(subscription: {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  // Log de diagnóstico (push com 0 dispositivos): o endpoint é truncado — é
  // uma URL longa com token do serviço de push, e o host + prefixo já bastam
  // pra saber de qual navegador veio.
  console.log("[push] salvarPushSubscriptionAluno recebido:", {
    aluno_id: user.id,
    endpoint: `${String(subscription?.endpoint ?? "").slice(0, 80)}…`,
    endpoint_length: String(subscription?.endpoint ?? "").length,
    p256dh_length: String(subscription?.p256dh ?? "").length,
    auth_key_length: String(subscription?.auth_key ?? "").length,
  });

  const parsed = pushSubscriptionSchema.safeParse(subscription);
  if (!parsed.success) {
    console.error("[push] subscription inválida:", parsed.error.issues[0]?.message);
    return { error: "Dados da inscrição push inválidos." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert({ ...parsed.data, aluno_id: user.id }, { onConflict: "endpoint" });

  if (error) {
    console.error("[push] erro ao salvar subscription:", { aluno_id: user.id, code: error.code, message: error.message });
    return { error: "Não foi possível ativar as notificações push." };
  }

  console.log("[push] subscription salva:", { aluno_id: user.id });
  return {};
}
