import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ContratoTemplateForm } from "@/components/admin/contrato-template-form";
import { getContratoTemplates, salvarContratoTemplate } from "./actions";
import {
  CONTRATO_TIPOS_CURSO,
  CONTRATO_TIPO_CURSO_LABELS,
  criarConteudoPadrao,
  type ContratoTemplate,
} from "@/lib/contratos/schema";

export default async function ContratoTemplatePage() {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const templatesExistentes = await getContratoTemplates();

  // Um template por tipo de curso — cria o que ainda não existir (mesma
  // lógica de antes, agora repetida pros 3 tipos em vez de um singleton).
  // Na prática, a migration 20260902100000 já copia presencial → ead/hibrido
  // na hora de aplicar; este fallback só cobre o caso raro de faltar algum.
  const templates: ContratoTemplate[] = await Promise.all(
    CONTRATO_TIPOS_CURSO.map(async (tipo) => {
      const existente = templatesExistentes.find((t) => t.tipo_curso === tipo);
      if (existente) return existente;

      const { data: criado } = await supabase
        .from("contrato_template")
        .insert({
          tipo_curso: tipo,
          nome: `Contrato ${CONTRATO_TIPO_CURSO_LABELS[tipo]}`,
          conteudo: criarConteudoPadrao(),
          created_by: user.id,
        })
        .select()
        .single();
      return criado as ContratoTemplate;
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Template de Contrato</h1>
        <p className="text-muted-foreground text-sm">
          Um modelo por tipo de curso — vale para os contratos de todas as matrículas daquele tipo.
        </p>
      </div>
      <ContratoTemplateForm
        templates={templates.map((template) => ({
          tipoCurso: template.tipo_curso,
          action: salvarContratoTemplate.bind(null, template.id ?? null, template.tipo_curso),
          defaultValues: {
            conteudo: template.conteudo ?? criarConteudoPadrao(),
            cor_texto: template.cor_texto ?? "#000000",
          },
        }))}
      />
    </div>
  );
}
