import "server-only";

import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACOES, MODULOS_ADMIN, type AdminAcao, type AdminModuloId } from "@/lib/auth/modulos-permissoes";

export type PermissoesUsuario = Record<AdminModuloId, Record<AdminAcao, boolean>>;

function permissoesComValor(valor: boolean): PermissoesUsuario {
  return Object.fromEntries(
    MODULOS_ADMIN.map((modulo) => [modulo.id, Object.fromEntries(ACOES.map((acao) => [acao, valor]))]),
  ) as PermissoesUsuario;
}

type LinhaPermissao = { modulo: AdminModuloId; acao: AdminAcao; permitido: boolean };

// Busca todas as permissões de um usuário. Sem nenhuma linha salva (usuário nunca teve
// permissões customizadas) devolve tudo marcado como true — reflete o acesso total que esse
// usuário tem de fato hoje (ver hasPermission), pra Sheet de edição abrir já coerente com a
// realidade em vez de começar "tudo desmarcado" por engano.
export async function getUserPermissions(userId: string): Promise<PermissoesUsuario> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data } = await admin.from("user_permissions").select("modulo, acao, permitido").eq("user_id", userId);

  if (!data || data.length === 0) return permissoesComValor(true);

  const mapa = permissoesComValor(false);
  for (const linha of data as LinhaPermissao[]) {
    mapa[linha.modulo][linha.acao] = linha.permitido;
  }
  return mapa;
}

// Upsert em lote de todos os módulos/ações (30 linhas = MODULOS_ADMIN.length * ACOES.length)
// de uma vez — mais simples que calcular um diff parcial, e o volume é pequeno.
export async function saveUserPermissions(
  userId: string,
  permissoes: PermissoesUsuario,
): Promise<{ ok: boolean; erro?: string }> {
  const usuarioAtual = await requireRole("admin");
  const admin = createAdminClient();

  const linhas = MODULOS_ADMIN.flatMap((modulo) =>
    ACOES.map((acao) => ({
      user_id: userId,
      modulo: modulo.id,
      acao,
      permitido: permissoes[modulo.id][acao],
      created_by: usuarioAtual.id,
    })),
  );

  const { error } = await admin.from("user_permissions").upsert(linhas, { onConflict: "user_id,modulo,acao" });
  if (error) {
    console.error("[permissions] erro ao salvar user_permissions:", { code: error.code, message: error.message });
    return { ok: false, erro: "Não foi possível salvar as permissões. Tente novamente." };
  }
  return { ok: true };
}

// REGRA DE RETROCOMPATIBILIDADE: usuário sem nenhuma linha em user_permissions nunca teve
// permissões customizadas definidas — continua com acesso total, exatamente como era antes
// desta feature existir. Só passa a ser restringido depois que um admin salva pelo menos uma
// vez pela Sheet de permissões (saveUserPermissions sempre grava as 30 combinações juntas).
export async function hasPermission(userId: string, modulo: AdminModuloId, acao: AdminAcao): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_permissions").select("modulo, acao, permitido").eq("user_id", userId);

  if (!data || data.length === 0) return true;

  const linha = (data as LinhaPermissao[]).find((item) => item.modulo === modulo && item.acao === acao);
  return linha?.permitido ?? false;
}

// Usado pela listagem de usuários (badge "Permissões customizadas"). ids vazio não bate a
// query — chamador já garante não chamar nesse caso.
export async function idsComPermissoesCustomizadas(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const admin = createAdminClient();
  const { data } = await admin.from("user_permissions").select("user_id").in("user_id", userIds);

  return new Set((data ?? []).map((linha) => linha.user_id as string));
}
