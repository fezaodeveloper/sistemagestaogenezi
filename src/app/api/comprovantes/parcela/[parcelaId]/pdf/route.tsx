import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarLogoEscolaParaPdf } from "@/lib/pdf/logo-escola";
import { ParcelaReciboPdf, type ResumoReciboParcela } from "@/components/pdf/parcela-recibo-pdf";

// Pública de propósito, mesmo padrão da rota irmã de comprovante de matrícula
// (src/app/api/comprovantes/[matriculaId]/pdf/route.ts): parcelaId funciona como bearer token
// implícito. .tsx (não .ts): renderToBuffer(<ParcelaReciboPdf .../>) precisa de JSX — React.
// createElement tem um tipo de retorno mais específico (FunctionComponentElement<P>) que não
// casa com a assinatura de renderToBuffer (ReactElement<DocumentProps>, não genérica); só a
// forma JSX erasa pro JSX.Element solto que a lib realmente aceita.
type LinhaParcela = {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  asaas_payment_id: string | null;
  observacoes: string | null;
  alunos: { full_name: string | null; cpf: string } | null;
  matriculas: { num_parcelas: number | null; turmas: { cursos: { nome: string } | null } | null } | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ parcelaId: string }> }) {
  const { parcelaId } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("parcelas")
    .select(
      "id, numero_parcela, valor, data_vencimento, data_pagamento, status, asaas_payment_id, observacoes, alunos(full_name, cpf), matriculas(num_parcelas, turmas(cursos(nome)))",
    )
    .eq("id", parcelaId)
    .maybeSingle();

  const parcela = data as unknown as LinhaParcela | null;

  // Só parcelas de fato pagas têm recibo — pendente/atrasado/cancelado/estornado não comprovam
  // pagamento nenhum.
  if (!parcela || parcela.status !== "pago") {
    return new Response("Recibo não encontrado.", { status: 404 });
  }

  const [{ data: configuracoes }, escolaLogo] = await Promise.all([
    admin
      .from("configuracoes")
      .select("escola_nome, escola_endereco, escola_telefone, escola_email, nome_diretor")
      .eq("id", true)
      .maybeSingle(),
    carregarLogoEscolaParaPdf(),
  ]);

  const resumo: ResumoReciboParcela = {
    parcelaId: parcela.id,
    aluno: { full_name: parcela.alunos?.full_name ?? null, cpf: parcela.alunos?.cpf ?? "" },
    cursoNome: parcela.matriculas?.turmas?.cursos?.nome ?? "—",
    numeroParcela: parcela.numero_parcela,
    totalParcelas: parcela.matriculas?.num_parcelas ?? parcela.numero_parcela,
    valor: Number(parcela.valor),
    dataVencimento: parcela.data_vencimento,
    dataPagamento: parcela.data_pagamento,
    asaasPaymentId: parcela.asaas_payment_id,
    observacoes: parcela.observacoes,
    escolaNome: configuracoes?.escola_nome ?? undefined,
    escolaLogoUrl: escolaLogo,
    escolaEndereco: configuracoes?.escola_endereco ?? undefined,
    escolaTelefone: configuracoes?.escola_telefone ?? undefined,
    escolaEmail: configuracoes?.escola_email ?? undefined,
    nomeDiretor: configuracoes?.nome_diretor ?? undefined,
  };

  const geradoEm = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const buffer = await renderToBuffer(<ParcelaReciboPdf resumo={resumo} geradoEm={geradoEm} />);

  // new Uint8Array(buffer): o generic de retorno de renderToBuffer (Buffer<ArrayBufferLike>) não
  // casa com o BodyInit que Response aceita — mesma normalização já usada na rota de
  // comprovante de matrícula.
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=recibo.pdf",
    },
  });
}
