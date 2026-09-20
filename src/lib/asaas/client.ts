import "server-only";

import { obterAsaasAdapter, type AsaasAdapter } from "@/lib/gateways/adapters/asaas";

// Camada de COMPATIBILIDADE: a lógica de chamada ao Asaas mudou-se para o adapter
// (src/lib/gateways/adapters/asaas.ts). Estas funções mantêm os mesmos nomes e
// assinaturas de sempre, então webhooks, crons e Server Actions existentes
// continuam importando daqui sem qualquer alteração.
//
// A chave da API agora é resolvida pelo adapter: primeiro a salva em
// gateways_config (tela /admin/configuracoes/gateways), depois — como sempre foi —
// as variáveis de ambiente ASAAS_API_KEY / ASAAS_API_URL. Código novo deve
// preferir getGatewayAtivo()/getAdapter() de "@/lib/gateways/manager".

type Dados<M extends keyof AsaasAdapter> = AsaasAdapter[M] extends (...args: infer A) => unknown ? A : never;

// ===== CLIENTES =====

export async function criarClienteAsaas(...args: Dados<"criarCliente">) {
  return (await obterAsaasAdapter()).criarCliente(...args);
}

export async function buscarClienteAsaasPorCpf(...args: Dados<"buscarClientePorCpf">) {
  return (await obterAsaasAdapter()).buscarClientePorCpf(...args);
}

// ===== COBRANÇAS =====

export async function criarCobrancaAsaas(...args: Dados<"criarCobranca">) {
  return (await obterAsaasAdapter()).criarCobranca(...args);
}

export async function cancelarCobrancaAsaas(...args: Dados<"cancelarCobranca">) {
  return (await obterAsaasAdapter()).cancelarCobranca(...args);
}

export async function estornarCobrancaAsaas(...args: Dados<"estornarCobranca">) {
  return (await obterAsaasAdapter()).estornarCobranca(...args);
}

export async function buscarCobrancaAsaas(...args: Dados<"buscarCobranca">) {
  return (await obterAsaasAdapter()).buscarCobranca(...args);
}

export async function confirmarRecebimentoDinheiro(...args: Dados<"confirmarRecebimentoDinheiro">) {
  return (await obterAsaasAdapter()).confirmarRecebimentoDinheiro(...args);
}

// ===== PARCELAMENTO =====

export async function criarParcelamentoAsaas(...args: Dados<"criarParcelamento">) {
  return (await obterAsaasAdapter()).criarParcelamento(...args);
}

export async function buscarParcelasDoParcelamento(...args: Dados<"buscarParcelasDoParcelamento">) {
  return (await obterAsaasAdapter()).buscarParcelasDoParcelamento(...args);
}

export async function gerarCarneAsaas(...args: Dados<"gerarCarne">) {
  return (await obterAsaasAdapter()).gerarCarne(...args);
}

// ===== ASSINATURAS (Gênezi Conecta — candidatos externos pagos) =====

export async function criarClienteAsaasConecta(...args: Dados<"criarClienteConecta">) {
  return (await obterAsaasAdapter()).criarClienteConecta(...args);
}

export async function criarAssinaturaConecta(...args: Dados<"criarAssinaturaConecta">) {
  return (await obterAsaasAdapter()).criarAssinaturaConecta(...args);
}

export async function cancelarAssinaturaConecta(...args: Dados<"cancelarAssinaturaConecta">) {
  return (await obterAsaasAdapter()).cancelarAssinaturaConecta(...args);
}

export async function buscarStatusAssinaturaConecta(...args: Dados<"buscarStatusAssinaturaConecta">) {
  return (await obterAsaasAdapter()).buscarStatusAssinaturaConecta(...args);
}

export async function buscarCobrancasAssinaturaConecta(...args: Dados<"buscarCobrancasAssinaturaConecta">) {
  return (await obterAsaasAdapter()).buscarCobrancasAssinaturaConecta(...args);
}

export async function buscarQrCodePixConecta(...args: Dados<"buscarQrCodePixConecta">) {
  return (await obterAsaasAdapter()).buscarQrCodePixConecta(...args);
}
