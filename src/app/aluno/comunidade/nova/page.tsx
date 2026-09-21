import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { exigirComunidadeAtiva } from "@/lib/comunidade/config";
import { ICONE_PADRAO } from "@/lib/comunidade/tipos";
import { ComunidadeNovoPostForm } from "@/components/aluno/comunidade-novo-post-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function ComunidadeNovoPostPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  await requireRole("aluno");
  const sp = await searchParams;

  const supabase = await createClient();
  await exigirComunidadeAtiva(supabase);

  // Só categorias em que o aluno pode postar (ativas e não restritas à equipe).
  const { data, error } = await supabase
    .from("comunidade_categorias")
    .select("id, nome, icone")
    .eq("ativo", true)
    .eq("somente_admin", false)
    .order("ordem")
    .order("nome");

  const categorias = ((data ?? []) as { id: string; nome: string; icone: string | null }[]).map((c) => ({
    id: c.id,
    nome: c.nome,
    icone: c.icone?.trim() || ICONE_PADRAO,
  }));
  const categoriaInicialId = categorias.some((c) => c.id === sp.categoria) ? (sp.categoria ?? null) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Button render={<Link href="/aluno/comunidade" />} nativeButton={false} variant="ghost" size="sm" className="mb-2 -ml-2">
          <ArrowLeft />
          Comunidade
        </Button>
        <h1 className="text-2xl font-semibold">Novo post</h1>
        <p className="text-muted-foreground text-sm">Compartilhe uma dúvida, ideia ou conquista com os colegas.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as categorias. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : categorias.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma categoria disponível para novos posts no momento.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-5">
            <ComunidadeNovoPostForm categorias={categorias} categoriaInicialId={categoriaInicialId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
