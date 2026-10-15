import { requireRole } from "@/lib/auth/dal";
import { getFinanceiroDados, getMatriculasParaParcela } from "@/app/admin/financeiro/actions";
import { FinanceiroView } from "@/components/admin/financeiro-view";
import { existeIntegracaoSpedyAtiva } from "@/lib/spedy/config";

// maxDuration numa page.tsx eleva o timeout de TODAS as Server Actions chamadas a partir dela
// (doc do Next: "If using Server Actions, set the maxDuration at the page level") — necessário
// pra enviarCobrancaEmMassaAction (envio sequencial com delay anti-banimento de 3-8s por
// mensagem, ver src/lib/whatsapp/evolution.ts) não ser encerrada pela plataforma no meio do
// envio. Mesmo valor já usado pelo cron de follow-up de leads
// (src/app/api/cron/followup-leads/route.ts), que tem a mesma natureza de envio sequencial.
export const maxDuration = 60;

export default async function FinanceiroPage() {
  await requireRole("admin");

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const [dados, matriculas, spedyAtivo] = await Promise.all([
    getFinanceiroDados(ano, mes),
    getMatriculasParaParcela(),
    existeIntegracaoSpedyAtiva(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-muted-foreground text-sm">
          Mensalidades, cobranças e recebimentos das matrículas.
        </p>
      </div>
      <FinanceiroView
        dadosIniciais={dados}
        anoInicial={ano}
        mesInicial={mes}
        matriculas={matriculas}
        spedyAtivo={spedyAtivo}
      />
    </div>
  );
}
