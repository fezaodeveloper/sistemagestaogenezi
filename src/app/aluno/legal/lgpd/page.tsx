import { requireRole } from "@/lib/auth/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LgpdSolicitacaoForm } from "@/components/aluno/lgpd-solicitacao-form";

export default async function LgpdPage() {
  await requireRole("aluno");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">LGPD — Seus direitos</h1>
        <p className="text-muted-foreground text-sm">
          A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante direitos sobre os seus
          dados pessoais. Veja quais são e como exercê-los.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-6 text-sm leading-relaxed">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Acesso</h2>
            <p>Você pode solicitar a confirmação de quais dados seus tratamos e obter uma cópia deles.</p>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Correção</h2>
            <p>Você pode pedir a correção de dados incompletos, inexatos ou desatualizados.</p>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Exclusão</h2>
            <p>
              Você pode solicitar a exclusão de dados desnecessários, excessivos ou tratados em
              desconformidade com a lei, ressalvados os dados que a escola deva manter por
              obrigação legal (ex.: histórico escolar).
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Portabilidade</h2>
            <p>Você pode solicitar a portabilidade dos seus dados a outro fornecedor de serviço.</p>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Revogação de consentimento</h2>
            <p>
              Quando o tratamento depender do seu consentimento (ex.: uso de imagem, participação
              no Gênezi Conecta), você pode revogá-lo a qualquer momento.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fazer uma solicitação</CardTitle>
        </CardHeader>
        <CardContent>
          <LgpdSolicitacaoForm />
        </CardContent>
      </Card>
    </div>
  );
}
