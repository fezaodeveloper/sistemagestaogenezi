import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PixelsView } from "@/components/admin/pixels-view";
import type { PixelItem } from "@/components/admin/pixel-dialog";
import type { CursoOpcao } from "@/components/admin/cursos-checklist";

type LinhaPixel = {
  id: string;
  nome: string;
  tipo: string;
  script: string;
  ativo: boolean;
  cursos_ids: string[] | null;
};

export default async function PixelsPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data, error }, { data: cursosData }] = await Promise.all([
    supabase.from("pixels_config").select("id, nome, tipo, script, ativo, cursos_ids").order("created_at", { ascending: false }),
    supabase.from("cursos").select("id, nome").order("nome"),
  ]);

  const pixels: PixelItem[] = ((data ?? []) as LinhaPixel[]).map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    tipo: linha.tipo,
    script: linha.script,
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
          <h1 className="text-2xl font-semibold">Pixels e Rastreamento</h1>
          <p className="text-muted-foreground text-sm">
            Meta Ads, TikTok, Google Ads, Google Analytics e scripts próprios nas páginas públicas de campanha e agendamento.
            Os eventos de visualização e de lead (inscrição/agendamento enviado) são disparados automaticamente.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler a tabela de pixels (a migration <code>pixels_config</code> já foi aplicada?).
        </p>
      )}

      <PixelsView pixels={pixels} cursos={(cursosData ?? []) as CursoOpcao[]} />
    </div>
  );
}
