import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PremioForm } from "@/components/admin/premio-form";
import { updatePremio } from "@/app/admin/premios/actions";
import type { Premio } from "@/lib/premios/schema";

export default async function EditarPremioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("premios").select("*").eq("id", id).single();
  const premio = data as Premio | null;

  if (!premio) {
    notFound();
  }

  const fotoAtualUrl = premio.foto_url
    ? supabase.storage.from("premios").getPublicUrl(premio.foto_url).data.publicUrl
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar prêmio</h1>
        <p className="text-muted-foreground text-sm">{premio.nome}</p>
      </div>
      <PremioForm
        action={updatePremio.bind(null, premio.id, premio.foto_url, premio.entrega_arquivo_path)}
        defaultValues={{
          nome: premio.nome,
          descricao: premio.descricao ?? undefined,
          custo_creditos: premio.custo_creditos,
          estoque: premio.estoque ?? undefined,
          estoque_minimo: premio.estoque_minimo ?? 5,
          ativo: premio.ativo,
          tipo: premio.tipo,
          entrega_email_conteudo: premio.entrega_email_conteudo ?? undefined,
          entrega_whatsapp_mensagem: premio.entrega_whatsapp_mensagem ?? undefined,
        }}
        fotoAtualUrl={fotoAtualUrl}
        temArquivoDigital={!!premio.entrega_arquivo_path}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
