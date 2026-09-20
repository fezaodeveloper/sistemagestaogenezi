import { requireRole } from "@/lib/auth/dal";
import { chaveCriptografiaConfigurada } from "@/lib/gateways/crypto";
import { listarGatewaysComAviso } from "@/lib/gateways/manager";
import { GatewaysView } from "@/components/admin/gateways-view";

export default async function GatewaysPage() {
  await requireRole("admin");

  const { gateways, erro } = await listarGatewaysComAviso();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Gateways de pagamento</h1>
        <p className="text-muted-foreground text-sm">
          Configure os gateways usados para cobrar. Apenas um pode estar ativo por vez. As credenciais são guardadas
          criptografadas e nunca voltam para esta tela depois de salvas.
        </p>
      </div>

      <GatewaysView gateways={gateways} avisoLeitura={erro} criptografiaConfigurada={chaveCriptografiaConfigurada()} />
    </div>
  );
}
