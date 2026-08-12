import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_EXPIRES_IN = 300; // 5 minutos

// RLS de certificados já restringe a select a linhas emitidas da própria
// matrícula do aluno — se a query voltar vazia, ou não é dele ou ainda
// não foi emitido, os dois casos tratados igual (404). A assinatura da
// URL roda com o client admin porque o bucket "certificados" não tem
// policy de select pra ninguém (mesmo padrão de materiais).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("aluno");
  const { id } = await params;

  const supabase = await createClient();
  const { data: certificado } = await supabase
    .from("certificados")
    .select("arquivo_url")
    .eq("id", id)
    .eq("status", "emitido")
    .single();

  if (!certificado?.arquivo_url) {
    return NextResponse.json({ error: "Certificado não encontrado." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("certificados")
    .createSignedUrl(certificado.arquivo_url, SIGNED_URL_EXPIRES_IN, { download: true });

  if (error || !signed) {
    return NextResponse.json({ error: "Não foi possível gerar o link de download." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
