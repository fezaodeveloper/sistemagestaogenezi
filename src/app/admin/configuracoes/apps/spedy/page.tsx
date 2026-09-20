import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { chaveCriptografiaConfigurada } from "@/lib/gateways/crypto";
import { SpedyView } from "@/components/admin/spedy-view";
import type { SpedyItem } from "@/components/admin/spedy-dialog";
import type { CursoOpcao } from "@/components/admin/cursos-checklist";

type LinhaIntegracao = {
  id: string;
  nome: string;
  ambiente: string;
  ativo: boolean;
  cursos_ids: string[] | null;
};

export default async function SpedyPage() {
  await requireRole("admin");

  const supabase = await createClient();
  // Nota: chave_api NÃO é selecionada — a chave (mesmo criptografada) nunca chega à tela.
  const [{ data, error }, { data: cursosData }] = await Promise.all([
    supabase.from("spedy_integracoes").select("id, nome, ambiente, ativo, cursos_ids").order("created_at", { ascending: false }),
    supabase.from("cursos").select("id, nome").order("nome"),
  ]);

  const integracoes: SpedyItem[] = ((data ?? []) as LinhaIntegracao[]).map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    ambiente: linha.ambiente === "producao" ? "producao" : "sandbox",
    ativo: linha.ativo,
    cursos_ids: linha.cursos_ids ?? [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/configuracoes/apps" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-3.5" />
          Apps
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Spedy NF-e</h1>
          <p className="text-muted-foreground text-sm">
            Emissão de nota fiscal de serviço (NFS-e) pela Spedy, automática a cada pagamento confirmado ou manual pelo botão
            &quot;Emitir NF&quot; das parcelas pagas.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler as integrações (a migration <code>spedy_integracoes</code> já foi aplicada?).
        </p>
      )}

      <SpedyView integracoes={integracoes} cursos={(cursosData ?? []) as CursoOpcao[]} criptografiaConfigurada={chaveCriptografiaConfigurada()} />
    </div>
  );
}
