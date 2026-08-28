"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { templateFormSchema } from "@/lib/certificados/schema";
import { TIPOS_IMAGEM_ACEITOS_PDF, uploadImagem, validarImagem } from "@/lib/storage/validar-imagem";

const TEMPLATE_BUCKET = "certificado-template";

type TemplateFormValuesEcho = {
  logo_posicao: string;
  logo_tamanho: string;
  cidade_emissao: string;
  estado_emissao: string;
  texto_frente: string;
  texto_verso: string;
};

export type TemplateFormState =
  | {
      errors?: Partial<
        Record<
          | "logo_posicao"
          | "logo_tamanho"
          | "texto_frente"
          | "texto_verso"
          | "cor_texto_frente"
          | "cor_texto_verso"
          | "fundo_frente"
          | "fundo_verso"
          | "logo"
          | "assinatura",
          string[]
        >
      >;
      error?: string;
      values?: TemplateFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): TemplateFormValuesEcho {
  return {
    logo_posicao: String(formData.get("logo_posicao") ?? ""),
    logo_tamanho: String(formData.get("logo_tamanho") ?? ""),
    cidade_emissao: String(formData.get("cidade_emissao") ?? ""),
    estado_emissao: String(formData.get("estado_emissao") ?? ""),
    texto_frente: String(formData.get("texto_frente") ?? ""),
    texto_verso: String(formData.get("texto_verso") ?? ""),
  };
}

async function tratarUpload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  campo: string,
  urlAtual: string | null,
): Promise<{ path: string | null; novoPath: string | null; erro?: string }> {
  const { erro, arquivo } = validarImagem(formData.get(campo), undefined, TIPOS_IMAGEM_ACEITOS_PDF);
  if (erro) return { path: urlAtual, novoPath: null, erro };
  if (!arquivo) return { path: urlAtual, novoPath: null };

  const { path, error } = await uploadImagem(supabase, TEMPLATE_BUCKET, arquivo);
  if (error || !path) {
    return { path: urlAtual, novoPath: null, erro: "Não foi possível enviar o arquivo. Tente novamente." };
  }
  return { path, novoPath: path };
}

export async function updateCertificadoTemplate(
  fundoFrenteAtual: string | null,
  fundoVersoAtual: string | null,
  logoAtual: string | null,
  assinaturaAtual: string | null,
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await requireRole("admin");

  const parsed = templateFormSchema.safeParse({
    logo_posicao: formData.get("logo_posicao"),
    logo_tamanho: formData.get("logo_tamanho"),
    cidade_emissao: formData.get("cidade_emissao") || undefined,
    estado_emissao: formData.get("estado_emissao") || undefined,
    texto_frente_margem_superior: formData.get("texto_frente_margem_superior"),
    texto_frente_margem_inferior: formData.get("texto_frente_margem_inferior"),
    texto_frente_margem_esquerda: formData.get("texto_frente_margem_esquerda"),
    texto_frente_margem_direita: formData.get("texto_frente_margem_direita"),
    texto_verso_margem_superior: formData.get("texto_verso_margem_superior"),
    texto_verso_margem_inferior: formData.get("texto_verso_margem_inferior"),
    texto_verso_margem_esquerda: formData.get("texto_verso_margem_esquerda"),
    texto_verso_margem_direita: formData.get("texto_verso_margem_direita"),
    cor_texto_frente: formData.get("cor_texto_frente"),
    cor_texto_verso: formData.get("cor_texto_verso"),
    assinatura_x_percentual: formData.get("assinatura_x_percentual"),
    assinatura_y_percentual: formData.get("assinatura_y_percentual"),
    assinatura_largura_px: formData.get("assinatura_largura_px"),
    texto_frente: formData.get("texto_frente"),
    texto_verso: formData.get("texto_verso"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();

  const fundoFrente = await tratarUpload(supabase, formData, "fundo_frente", fundoFrenteAtual);
  if (fundoFrente.erro) {
    return { errors: { fundo_frente: [fundoFrente.erro] }, values: echoValues(formData) };
  }
  const fundoVerso = await tratarUpload(supabase, formData, "fundo_verso", fundoVersoAtual);
  if (fundoVerso.erro) {
    return { errors: { fundo_verso: [fundoVerso.erro] }, values: echoValues(formData) };
  }
  const logo = await tratarUpload(supabase, formData, "logo", logoAtual);
  if (logo.erro) {
    return { errors: { logo: [logo.erro] }, values: echoValues(formData) };
  }
  const assinatura = await tratarUpload(supabase, formData, "assinatura", assinaturaAtual);
  if (assinatura.erro) {
    return { errors: { assinatura: [assinatura.erro] }, values: echoValues(formData) };
  }

  const novosArquivos = [fundoFrente.novoPath, fundoVerso.novoPath, logo.novoPath, assinatura.novoPath].filter(
    (p): p is string => p !== null,
  );

  const { error } = await supabase
    .from("certificado_template")
    .update({
      fundo_frente_url: fundoFrente.path,
      fundo_verso_url: fundoVerso.path,
      logo_url: logo.path,
      assinatura_url: assinatura.path,
      logo_posicao: parsed.data.logo_posicao,
      logo_tamanho: parsed.data.logo_tamanho,
      cidade_emissao: parsed.data.cidade_emissao ?? null,
      estado_emissao: parsed.data.estado_emissao ?? null,
      texto_frente_margens: {
        superior: parsed.data.texto_frente_margem_superior,
        inferior: parsed.data.texto_frente_margem_inferior,
        esquerda: parsed.data.texto_frente_margem_esquerda,
        direita: parsed.data.texto_frente_margem_direita,
      },
      texto_verso_margens: {
        superior: parsed.data.texto_verso_margem_superior,
        inferior: parsed.data.texto_verso_margem_inferior,
        esquerda: parsed.data.texto_verso_margem_esquerda,
        direita: parsed.data.texto_verso_margem_direita,
      },
      cor_texto_frente: parsed.data.cor_texto_frente,
      cor_texto_verso: parsed.data.cor_texto_verso,
      assinatura_x_percentual: parsed.data.assinatura_x_percentual,
      assinatura_y_percentual: parsed.data.assinatura_y_percentual,
      assinatura_largura_px: parsed.data.assinatura_largura_px,
      texto_frente: parsed.data.texto_frente,
      texto_verso: parsed.data.texto_verso,
      updated_by: user.id,
    })
    .eq("id", true);

  if (error) {
    if (novosArquivos.length) await supabase.storage.from(TEMPLATE_BUCKET).remove(novosArquivos);
    return { error: "Não foi possível salvar o template. Tente novamente." };
  }

  // Só remove os arquivos antigos depois que os novos já estão salvos —
  // evita ficar sem imagem nenhuma se o remove() falhar no meio do caminho.
  const antigosParaRemover = [
    fundoFrente.novoPath && fundoFrenteAtual !== fundoFrente.novoPath ? fundoFrenteAtual : null,
    fundoVerso.novoPath && fundoVersoAtual !== fundoVerso.novoPath ? fundoVersoAtual : null,
    logo.novoPath && logoAtual !== logo.novoPath ? logoAtual : null,
    assinatura.novoPath && assinaturaAtual !== assinatura.novoPath ? assinaturaAtual : null,
  ].filter((p): p is string => p !== null);
  if (antigosParaRemover.length) {
    await supabase.storage.from(TEMPLATE_BUCKET).remove(antigosParaRemover);
  }

  revalidatePath("/admin/certificados/template");
  return { values: echoValues(formData) };
}
