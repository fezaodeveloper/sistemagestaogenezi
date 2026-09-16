import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TERMO_LEGAL_CHAVES, type TermoLegalChave } from "@/lib/termos-legais/schema";
import { TermoLegalEditor } from "@/components/admin/termo-legal-editor";

type TermoLegalRow = {
  titulo: string;
  conteudo: string;
  atualizado_em: string;
  atualizado_por: { full_name: string | null } | null;
};

export default async function EditarTermoLegalPage({
  params,
}: {
  params: Promise<{ chave: string }>;
}) {
  await requireRole("admin");
  const { chave: chaveParam } = await params;

  if (!(TERMO_LEGAL_CHAVES as readonly string[]).includes(chaveParam)) {
    notFound();
  }
  const chave = chaveParam as TermoLegalChave;

  const supabase = await createClient();
  const { data } = await supabase
    .from("termos_legais")
    .select("titulo, conteudo, atualizado_em, atualizado_por:profiles(full_name)")
    .eq("chave", chave)
    .single();

  if (!data) {
    notFound();
  }

  const termo = data as unknown as TermoLegalRow;

  return (
    <TermoLegalEditor
      chave={chave}
      titulo={termo.titulo}
      conteudoInicial={termo.conteudo}
      atualizadoEm={termo.atualizado_em}
      atualizadoPorNome={termo.atualizado_por?.full_name ?? null}
    />
  );
}
