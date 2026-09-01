import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ContratoTemplateForm } from "@/components/admin/contrato-template-form";
import { salvarContratoTemplate } from "./actions";
import { criarConteudoPadrao, type ContratoTemplate } from "@/lib/contratos/schema";

export default async function ContratoTemplatePage() {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("contrato_template").select("*").maybeSingle();
  let template = data as ContratoTemplate | null;

  // Nasce com o texto padrão na primeira visita — o admin edita a partir
  // daí (ver TAREFA 2 em src/lib/contratos/schema.ts).
  if (!template) {
    const { data: criado } = await supabase
      .from("contrato_template")
      .insert({ conteudo: criarConteudoPadrao(), created_by: user.id })
      .select()
      .single();
    template = criado as ContratoTemplate | null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Template de Contrato</h1>
        <p className="text-muted-foreground text-sm">
          Configuração única para toda a escola — vale para os contratos de todas as matrículas.
        </p>
      </div>
      <ContratoTemplateForm
        action={salvarContratoTemplate.bind(null, template?.id ?? null)}
        defaultValues={{
          conteudo: template?.conteudo ?? criarConteudoPadrao(),
          cor_texto: template?.cor_texto ?? "#000000",
        }}
      />
    </div>
  );
}
