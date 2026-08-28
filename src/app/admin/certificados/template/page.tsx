import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CertificadoTemplateForm } from "@/components/admin/certificado-template-form";
import { updateCertificadoTemplate } from "./actions";
import type { CertificadoTemplate } from "@/lib/certificados/schema";

export default async function CertificadoTemplatePage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("certificado_template").select("*").eq("id", true).single();
  const template = data as CertificadoTemplate | null;

  const bucket = supabase.storage.from("certificado-template");
  const fundoFrenteAtualUrl = template?.fundo_frente_url
    ? bucket.getPublicUrl(template.fundo_frente_url).data.publicUrl
    : null;
  const fundoVersoAtualUrl = template?.fundo_verso_url
    ? bucket.getPublicUrl(template.fundo_verso_url).data.publicUrl
    : null;
  const logoAtualUrl = template?.logo_url ? bucket.getPublicUrl(template.logo_url).data.publicUrl : null;
  const assinaturaAtualUrl = template?.assinatura_url
    ? bucket.getPublicUrl(template.assinatura_url).data.publicUrl
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Template do certificado</h1>
        <p className="text-muted-foreground text-sm">
          Configuração única para toda a escola — vale para os certificados de todos os cursos.
        </p>
      </div>
      <CertificadoTemplateForm
        action={updateCertificadoTemplate.bind(
          null,
          template?.fundo_frente_url ?? null,
          template?.fundo_verso_url ?? null,
          template?.logo_url ?? null,
          template?.assinatura_url ?? null,
        )}
        defaultValues={{
          logo_posicao: template?.logo_posicao ?? "sem_logo",
          logo_tamanho: template?.logo_tamanho ?? "medio",
          cidade_emissao: template?.cidade_emissao ?? "",
          estado_emissao: template?.estado_emissao ?? "",
          texto_frente: template?.texto_frente ?? { type: "doc", content: [{ type: "paragraph" }] },
          texto_verso: template?.texto_verso ?? { type: "doc", content: [{ type: "paragraph" }] },
          texto_frente_margens: template?.texto_frente_margens ?? {
            superior: 20,
            inferior: 20,
            esquerda: 10,
            direita: 10,
          },
          texto_verso_margens: template?.texto_verso_margens ?? {
            superior: 20,
            inferior: 20,
            esquerda: 10,
            direita: 10,
          },
          cor_texto_frente: template?.cor_texto_frente ?? "#000000",
          cor_texto_verso: template?.cor_texto_verso ?? "#000000",
          assinatura_x_percentual: template?.assinatura_x_percentual ?? 50,
          assinatura_y_percentual: template?.assinatura_y_percentual ?? 90,
          assinatura_largura_px: template?.assinatura_largura_px ?? 200,
        }}
        fundoFrenteAtualUrl={fundoFrenteAtualUrl}
        fundoVersoAtualUrl={fundoVersoAtualUrl}
        logoAtualUrl={logoAtualUrl}
        assinaturaAtualUrl={assinaturaAtualUrl}
      />
    </div>
  );
}
