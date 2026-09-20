import {
  GatewayNaoConfiguradoError,
  GatewayTipo,
  MENSAGEM_GATEWAY_NAO_CONFIGURADO,
  type CobrancaParams,
  type CobrancaResult,
  type CobrancaStatus,
  type GatewayAdapter,
  type ResultadoTesteConexao,
} from "@/lib/gateways/types";

// STUB — integração com o Pagar.me prevista para as próximas fases. Implementa a
// interface comum, mas todo método responde "Gateway não configurado".
export class PagarmeAdapter implements GatewayAdapter {
  readonly tipo = GatewayTipo.Pagarme;

  async testarConexao(): Promise<ResultadoTesteConexao> {
    return { ok: false, erro: MENSAGEM_GATEWAY_NAO_CONFIGURADO };
  }

  async gerarCobranca(params: CobrancaParams): Promise<CobrancaResult> {
    void params;
    throw new GatewayNaoConfiguradoError();
  }

  async cancelarCobranca(id: string): Promise<void> {
    void id;
    throw new GatewayNaoConfiguradoError();
  }

  async consultarCobranca(id: string): Promise<CobrancaStatus> {
    void id;
    throw new GatewayNaoConfiguradoError();
  }
}
