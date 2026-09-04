"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, FileText, Paperclip, Plus, Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import {
  cancelarParcela,
  criarParcelaManual,
  estornarParcela,
  gerarCarne,
  gerarCobranca,
  getFinanceiroDados,
  marcarComoPagoManual,
  marcarNotaFiscal,
  salvarNotaFiscal,
  type FinanceiroDados,
  type MatriculaParaParcela,
  type ParcelaComRelacoes,
} from "@/app/admin/financeiro/actions";
import { gerarRelatorioMEI } from "@/app/admin/financeiro/mei/actions";
import { createClient } from "@/lib/supabase/client";
import { WhatsappStubDropdown } from "@/components/admin/whatsapp-stub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paginacao } from "@/components/ui/paginacao";
import { LIMITE_PADRAO, calcularTotalPaginas } from "@/lib/paginacao";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  PARCELA_STATUS_BADGE_CLASS,
  PARCELA_STATUS_LABELS,
} from "@/lib/financeiro/schema";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS } from "@/lib/matriculas/schema";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...PARCELA_STATUS_LABELS,
};

// Mesmo padrão de toggle Eye/EyeOff + localStorage de
// dashboard-kpis-financeiros.tsx — chave própria (não afeta o toggle do
// dashboard, cada tela lembra sua própria preferência).
const KPIS_VISIVEL_STORAGE_KEY = "genezi-financeiro-kpis-visivel";
const VALOR_OCULTO = "R$ ••••";

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function base64ParaBlob(base64: string, tipo: string): Blob {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

const carneStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 16 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  item: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
  },
  linha: { marginBottom: 3 },
  label: { fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 16, fontSize: 9, textAlign: "center", color: "#555555" },
});

function CarneDocument({ parcelas }: { parcelas: ParcelaComRelacoes[] }) {
  return (
    <Document>
      <Page size="A4" orientation="portrait" style={carneStyles.page}>
        <View style={carneStyles.header}>
          <Text style={carneStyles.title}>GÊNEZI — Educação Profissional — Carnê de Pagamento</Text>
        </View>

        {parcelas.map((parcela) => (
          <View key={parcela.id} style={carneStyles.item}>
            <Text style={carneStyles.linha}>
              <Text style={carneStyles.label}>Aluno: </Text>
              {parcela.alunos?.full_name ?? "—"}
            </Text>
            <Text style={carneStyles.linha}>
              Parcela nº {parcela.numero_parcela} de {parcela.matriculas?.num_parcelas ?? "?"}
            </Text>
            <Text style={carneStyles.linha}>Vencimento: {formatDataBR(parcela.data_vencimento)}</Text>
            <Text style={carneStyles.linha}>Valor: {formatValor(Number(parcela.valor))}</Text>
            <Text style={carneStyles.linha}>Link da fatura: {parcela.asaas_invoice_url}</Text>
          </View>
        ))}

        <Text style={carneStyles.footer}>Pagamento via Pix ou Boleto — acesse o link acima</Text>
      </Page>
    </Document>
  );
}

function KpiCard({
  label,
  valor,
  cor,
  sublabel,
}: {
  label: string;
  valor: string;
  cor: "amber" | "green" | "red" | "blue";
  sublabel?: string;
}) {
  const corTexto: Record<string, string> = {
    amber: "#FFB020",
    green: "#2DD4A0",
    red: "#FF5A5F",
    blue: "#2196F3",
  };
  return (
    <Card className={`gz-kpi gz-kpi-${cor}`}>
      <CardContent className="flex flex-col gap-1.5 py-4">
        <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
          {label}
        </span>
        <span className="gz-num text-[22px]" style={{ color: corTexto[cor] }}>
          {valor}
        </span>
        {sublabel && <span className="text-muted-foreground text-xs">{sublabel}</span>}
      </CardContent>
    </Card>
  );
}

function NovaParcelaDialog({
  matriculas,
  onCriada,
}: {
  matriculas: MatriculaParaParcela[];
  onCriada: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [matriculaId, setMatriculaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matriculaItems = Object.fromEntries(
    matriculas.map((matricula) => [
      matricula.id,
      `${matricula.alunos?.full_name ?? "—"} — ${matricula.turmas?.nome ?? "—"}`,
    ]),
  );

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarParcelaManual(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      setMatriculaId("");
      onCriada();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Nova parcela manual
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova parcela manual</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="matricula_id">Matrícula</Label>
            <Select
              name="matricula_id"
              items={matriculaItems}
              value={matriculaId}
              onValueChange={(value) => setMatriculaId(value as string)}
            >
              <SelectTrigger id="matricula_id" className="w-full">
                <SelectValue placeholder="Selecione a matrícula" />
              </SelectTrigger>
              <SelectContent>
                {matriculas.map((matricula) => (
                  <SelectItem key={matricula.id} value={matricula.id}>
                    {matricula.alunos?.full_name ?? "—"} — {matricula.turmas?.nome ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="numero_parcela">Nº da parcela</Label>
              <Input id="numero_parcela" name="numero_parcela" type="number" min={1} defaultValue={1} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor">Valor</Label>
              <Input id="valor" name="valor" type="number" step="0.01" min={0.01} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_vencimento">Vencimento</Label>
            <Input id="data_vencimento" name="data_vencimento" type="date" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
            <Select name="forma_pagamento" items={FORMA_PAGAMENTO_LABELS}>
              <SelectTrigger id="forma_pagamento" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((formaPagamento) => (
                  <SelectItem key={formaPagamento} value={formaPagamento}>
                    {FORMA_PAGAMENTO_LABELS[formaPagamento]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Input id="observacoes" name="observacoes" placeholder="Opcional" />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !matriculaId}>
              {isPending ? "Salvando..." : "Criar parcela"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RelatorioMeiButton({ ano, mes }: { ano: number; mes: number }) {
  const [gerando, setGerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGerar() {
    // Abre a aba em branco já no clique (síncrono), antes do await — mesmo
    // motivo de handleGerarCarne (bloqueio de pop-up).
    const novaAba = window.open("", "_blank");
    setError(null);
    setGerando(true);
    try {
      const resultado = await gerarRelatorioMEI(ano, mes);
      if ("error" in resultado) {
        setError(resultado.error);
        novaAba?.close();
        return;
      }
      const blob = base64ParaBlob(resultado.pdf, "application/pdf");
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={handleGerar} disabled={gerando}>
        <FileText />
        {gerando ? "Gerando..." : "Relatório MEI"}
      </Button>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

const NOTA_FISCAL_BUCKET = "notas-fiscais";
const NOTA_FISCAL_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const NOTA_FISCAL_TIPOS_ACEITOS = [
  "application/pdf",
  "text/xml",
  "application/xml",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

function extensaoDoArquivo(nomeOuPath: string): string {
  const partes = nomeOuPath.split(".");
  return partes.length > 1 ? (partes.pop() ?? "").toLowerCase() : "";
}

// Bucket privado (ver 20260903200000_nota_fiscal.sql) — upload direto do
// client com a sessão do admin (mesmo padrão de foto-aluno-upload.tsx),
// mas sem getPublicUrl() servir de nada aqui: como o bucket não é público,
// "Ver NF" sempre gera uma signed URL na hora do clique em vez de reusar
// uma URL permanente.
function NotaFiscalControl({
  parcela,
  onAtualizada,
}: {
  parcela: ParcelaComRelacoes;
  onAtualizada: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleToggle(checked: boolean) {
    setError(null);
    startTransition(async () => {
      const resultado = await marcarNotaFiscal(parcela.id, checked);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      onAtualizada();
    });
  }

  async function handleArquivoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!NOTA_FISCAL_TIPOS_ACEITOS.includes(file.type)) {
      setError("Formato não aceito. Use PDF, XML, JPG ou PNG.");
      return;
    }
    if (file.size > NOTA_FISCAL_MAX_BYTES) {
      setError("Arquivo muito grande. Máximo permitido: 10MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      // Nome fixo (parcelaId.ext): upsert sobrescreve direto se o admin
      // reenviar uma NF corrigida, sem precisar remover antes.
      const extensao = extensaoDoArquivo(file.name) || "pdf";
      const path = `${parcela.id}.${extensao}`;

      const { error: uploadError } = await supabase.storage.from(NOTA_FISCAL_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) {
        setError(`Erro no upload: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from(NOTA_FISCAL_BUCKET).getPublicUrl(path);

      const resultado = await salvarNotaFiscal(parcela.id, urlData.publicUrl, path);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      onAtualizada();
    } finally {
      setEnviando(false);
    }
  }

  async function handleVer() {
    if (!parcela.nota_fiscal_path) return;

    // Abre a aba em branco já no clique (síncrono), antes do await — mesmo
    // motivo de handleGerarCarne/handleImprimirComprovante (bloqueio de
    // pop-up).
    const novaAba = window.open("", "_blank");
    setError(null);

    const supabase = createClient();
    const ehXml = extensaoDoArquivo(parcela.nota_fiscal_path) === "xml";
    const { data, error: signedError } = await supabase.storage
      .from(NOTA_FISCAL_BUCKET)
      .createSignedUrl(parcela.nota_fiscal_path, 60, ehXml ? { download: parcela.nota_fiscal_path } : undefined);

    if (signedError || !data) {
      setError("Não foi possível abrir o arquivo.");
      novaAba?.close();
      return;
    }

    if (novaAba) {
      novaAba.location.href = data.signedUrl;
    } else {
      window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`nf_emitida_${parcela.id}`}
          checked={parcela.nota_fiscal_emitida}
          onCheckedChange={(checked) => handleToggle(checked === true)}
          disabled={isPending}
        />
        <Label htmlFor={`nf_emitida_${parcela.id}`} className="text-xs font-normal">
          NF emitida
        </Label>

        {parcela.nota_fiscal_emitida && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.xml,.jpg,.jpeg,.png"
              onChange={handleArquivoChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
            >
              <Paperclip />
              {enviando ? "Enviando..." : "Anexar NF"}
            </Button>
            {parcela.nota_fiscal_path && (
              <Button type="button" variant="ghost" size="sm" onClick={handleVer}>
                <Eye />
                Ver NF
              </Button>
            )}
          </>
        )}
      </div>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

function AcoesParcela({
  parcela,
  onAtualizada,
}: {
  parcela: ParcelaComRelacoes;
  onAtualizada: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [confirmandoEstorno, setConfirmandoEstorno] = useState(false);
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);
  const [gerandoCarne, setGerandoCarne] = useState(false);

  async function handleGerarCarne() {
    const installmentId = parcela.matriculas?.asaas_installment_id;
    if (!installmentId) return;

    // Abre a aba em branco já no clique (síncrono), antes do await — mesmo
    // motivo do handleGerarCarne em lote logo abaixo (bloqueio de pop-up).
    const novaAba = window.open("", "_blank");
    setError(null);
    setGerandoCarne(true);
    try {
      const resultado = await gerarCarne(installmentId);
      if ("error" in resultado) {
        setError(resultado.error);
        novaAba?.close();
        return;
      }
      const blob = base64ParaBlob(resultado.pdf, "application/pdf");
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } finally {
      setGerandoCarne(false);
    }
  }

  function handleGerarCobranca() {
    setError(null);
    startTransition(async () => {
      const resultado = await gerarCobranca(parcela.id);
      if ("error" in resultado) setError(resultado.error);
      else onAtualizada();
    });
  }

  function handleCancelar() {
    setError(null);
    startTransition(async () => {
      const resultado = await cancelarParcela(parcela.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setConfirmandoCancelamento(false);
      onAtualizada();
    });
  }

  function handleEstornar() {
    setError(null);
    startTransition(async () => {
      const resultado = await estornarParcela(parcela.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setConfirmandoEstorno(false);
      onAtualizada();
    });
  }

  function handleMarcarComoPago(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const dataPagamento = String(formData.get("data_pagamento") ?? "");
      const valor = Number(formData.get("valor"));
      const resultado = await marcarComoPagoManual(parcela.id, dataPagamento, valor);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setPagamentoDialogOpen(false);
      onAtualizada();
    });
  }

  const emAberto = parcela.status === "pendente" || parcela.status === "atrasado";
  // Cartão é processado na maquininha Infinipay (fora do Asaas) — nunca gera
  // cobrança, só permite baixa manual. Com asaas_payment_id já existente
  // (boleto/Pix), "Marcar como pago" também fica disponível, pra cobrir
  // pagamento presencial de uma fatura que já foi gerada.
  const podeGerarCobranca = emAberto && !parcela.asaas_payment_id && parcela.forma_pagamento !== "cartao";
  const podeMarcarComoPago =
    emAberto && (parcela.forma_pagamento === "cartao" || Boolean(parcela.asaas_payment_id));

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {podeGerarCobranca && (
          <Button variant="ghost" size="sm" onClick={handleGerarCobranca} disabled={isPending}>
            {isPending ? "Gerando..." : "Gerar cobrança"}
          </Button>
        )}
        <WhatsappStubDropdown
          matriculaId={parcela.matricula_id}
          opcoes={[
            {
              tipo: "cobranca",
              label: "Enviar cobrança",
              mensagem: parcela.asaas_invoice_url
                ? `Integração com WhatsApp em breve. Quando ativa, enviará o link da fatura: ${parcela.asaas_invoice_url}`
                : "Integração com WhatsApp em breve.",
            },
            {
              tipo: "comprovante",
              label: "Enviar comprovante",
              mensagem:
                parcela.status === "pago"
                  ? "Integração com WhatsApp em breve. Quando ativa, enviará o comprovante de pagamento ao aluno."
                  : "Integração com WhatsApp em breve. Quando ativa, enviará o comprovante quando o pagamento for confirmado.",
            },
          ]}
        />
        {parcela.asaas_invoice_url && (
          <Button
            render={<a href={parcela.asaas_invoice_url} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            <ExternalLink />
            Ver fatura
          </Button>
        )}
        {parcela.matriculas?.asaas_installment_id && (
          <Button variant="ghost" size="sm" onClick={handleGerarCarne} disabled={gerandoCarne}>
            <Printer />
            {gerandoCarne ? "Gerando..." : "Carnê Asaas"}
          </Button>
        )}
        {podeMarcarComoPago && (
          <Dialog
            open={pagamentoDialogOpen}
            onOpenChange={(nextOpen) => {
              setPagamentoDialogOpen(nextOpen);
              if (nextOpen) setError(null);
            }}
          >
            <DialogTrigger render={<Button variant="ghost" size="sm">Marcar como pago</Button>} />
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Marcar como pago</DialogTitle>
              </DialogHeader>
              <form action={handleMarcarComoPago} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`data_pagamento_${parcela.id}`}>Data do pagamento</Label>
                  <Input
                    id={`data_pagamento_${parcela.id}`}
                    name="data_pagamento"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`valor_pago_${parcela.id}`}>Valor pago</Label>
                  <Input
                    id={`valor_pago_${parcela.id}`}
                    name="valor"
                    type="number"
                    step="0.01"
                    min={0.01}
                    defaultValue={Number(parcela.valor)}
                    required
                  />
                </div>
                {error && (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Confirmando..." : "Confirmar pagamento"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
        {emAberto && (
          <AlertDialog open={confirmandoCancelamento} onOpenChange={setConfirmandoCancelamento}>
            <AlertDialogTrigger render={<Button variant="ghost" size="sm">Cancelar</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar parcela</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja cancelar a parcela {parcela.numero_parcela} de &quot;
                  {parcela.alunos?.full_name ?? "—"}&quot;?
                  {parcela.asaas_payment_id &&
                    " A cobrança correspondente também será cancelada no Asaas."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleCancelar}>
                  {isPending ? "Cancelando..." : "Cancelar parcela"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {parcela.status === "pago" && parcela.asaas_payment_id && (
          <AlertDialog open={confirmandoEstorno} onOpenChange={setConfirmandoEstorno}>
            <AlertDialogTrigger render={<Button variant="ghost" size="sm">Estornar</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Estornar pagamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja estornar o pagamento da parcela {parcela.numero_parcela} de{" "}
                  {parcela.alunos?.full_name ?? "—"}? O valor será devolvido ao aluno via Asaas. Esta ação
                  não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleEstornar}>
                  {isPending ? "Estornando..." : "Estornar pagamento"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {parcela.status === "pago" && (
        <NotaFiscalControl parcela={parcela} onAtualizada={onAtualizada} />
      )}
      {error && !pagamentoDialogOpen && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

export function FinanceiroView({
  dadosIniciais,
  anoInicial,
  mesInicial,
  matriculas,
}: {
  dadosIniciais: FinanceiroDados;
  anoInicial: number;
  mesInicial: number;
  matriculas: MatriculaParaParcela[];
}) {
  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);
  const [dados, setDados] = useState(dadosIniciais);
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [gerandoCarne, setGerandoCarne] = useState(false);
  const [modoFiltro, setModoFiltro] = useState<"mes" | "periodo">("mes");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(LIMITE_PADRAO);
  const [kpisVisiveis, setKpisVisiveis] = useState(true);
  const [kpisHydrated, setKpisHydrated] = useState(false);

  // Leitura de localStorage tem que ficar num efeito pós-montagem, não num
  // inicializador de useState — mesmo motivo já documentado em
  // dashboard-kpis-financeiros.tsx (evita hydration mismatch).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(KPIS_VISIVEL_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo !== null) setKpisVisiveis(salvo === "true");
    } catch {}
    setKpisHydrated(true);
  }, []);

  useEffect(() => {
    if (!kpisHydrated) return;
    try {
      localStorage.setItem(KPIS_VISIVEL_STORAGE_KEY, String(kpisVisiveis));
    } catch {}
  }, [kpisVisiveis, kpisHydrated]);

  // Sempre busca com o modo de filtro (mês ou período) e a página/limite
  // atuais — centraliza a lógica que antes estava duplicada em
  // irParaMes/recarregar/handleModoFiltro/handleAplicarPeriodo.
  function buscar(novoAno: number, novoMes: number, novaPagina: number, novoLimite: number) {
    startTransition(async () => {
      const novosDados =
        modoFiltro === "periodo" && periodoInicio && periodoFim
          ? await getFinanceiroDados(novoAno, novoMes, periodoInicio, periodoFim, novaPagina, novoLimite)
          : await getFinanceiroDados(novoAno, novoMes, undefined, undefined, novaPagina, novoLimite);
      setAno(novoAno);
      setMes(novoMes);
      setPagina(novaPagina);
      setLimite(novoLimite);
      setDados(novosDados);
      setSelecionadas(new Set());
    });
  }

  function irParaMes(novoAno: number, novoMes: number) {
    buscar(novoAno, novoMes, 1, limite);
  }

  // Recarrega a página atual (usado depois de criar/atualizar/cancelar uma
  // parcela) — mantém o filtro e a página em que o admin está, só refaz a
  // busca pros dados poderem ter mudado.
  function recarregar() {
    buscar(ano, mes, pagina, limite);
  }

  function handleMesAnterior() {
    irParaMes(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1);
  }

  function handleProximoMes() {
    irParaMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1);
  }

  function handleModoFiltro(modo: "mes" | "periodo") {
    setModoFiltro(modo);
    if (modo === "mes") {
      startTransition(async () => {
        const novosDados = await getFinanceiroDados(ano, mes, undefined, undefined, 1, limite);
        setPagina(1);
        setDados(novosDados);
        setSelecionadas(new Set());
      });
    }
  }

  function handleAplicarPeriodo() {
    if (!periodoInicio || !periodoFim) return;
    startTransition(async () => {
      const novosDados = await getFinanceiroDados(ano, mes, periodoInicio, periodoFim, 1, limite);
      setPagina(1);
      setDados(novosDados);
      setSelecionadas(new Set());
    });
  }

  function handlePaginar(novaPagina: number, novoLimite: number) {
    buscar(ano, mes, novaPagina, novoLimite);
  }

  const parcelasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return dados.parcelas.filter((parcela) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && parcela.status !== statusFiltro) return false;
      if (!termo) return true;
      const nomeAluno = (parcela.alunos?.full_name ?? "").toLowerCase();
      return nomeAluno.includes(termo);
    });
  }, [dados.parcelas, busca, statusFiltro]);

  const adimplencia = useMemo(() => {
    const denominador = dados.kpis.totalRecebido + dados.kpis.totalAtrasado;
    if (denominador === 0) return null;
    return (dados.kpis.totalRecebido / denominador) * 100;
  }, [dados.kpis]);

  function toggleParcela(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodasVisiveis() {
    const idsVisiveis = parcelasFiltradas.map((parcela) => parcela.id);
    const todasSelecionadas = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionadas.has(id));
    setSelecionadas(todasSelecionadas ? new Set() : new Set(idsVisiveis));
  }

  const parcelasSelecionadas = useMemo(
    () => dados.parcelas.filter((parcela) => selecionadas.has(parcela.id)),
    [dados.parcelas, selecionadas],
  );
  const parcelasComFatura = useMemo(
    () => parcelasSelecionadas.filter((parcela) => parcela.asaas_invoice_url),
    [parcelasSelecionadas],
  );
  const quantidadeSemFatura = parcelasSelecionadas.length - parcelasComFatura.length;

  async function handleGerarCarne() {
    const novaAba = window.open("", "_blank");
    setGerandoCarne(true);
    try {
      const blob = await pdf(<CarneDocument parcelas={parcelasComFatura} />).toBlob();
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } finally {
      setGerandoCarne(false);
    }
  }

  const todasVisiveisSelecionadas =
    parcelasFiltradas.length > 0 && parcelasFiltradas.every((parcela) => selecionadas.has(parcela.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex w-fit items-center gap-1 rounded-md border p-0.5">
            <Button
              type="button"
              variant={modoFiltro === "mes" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleModoFiltro("mes")}
            >
              Por mês
            </Button>
            <Button
              type="button"
              variant={modoFiltro === "periodo" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleModoFiltro("periodo")}
            >
              Por período
            </Button>
          </div>

          {modoFiltro === "mes" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleMesAnterior}
                disabled={isPending}
                aria-label="Mês anterior"
              >
                <ChevronLeft />
              </Button>
              <span className="w-40 text-center text-lg font-semibold">
                {NOMES_MES[mes - 1]} {ano}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleProximoMes}
                disabled={isPending}
                aria-label="Próximo mês"
              >
                <ChevronRight />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="periodo_inicio" className="text-xs">
                  De:
                </Label>
                <Input
                  id="periodo_inicio"
                  type="date"
                  value={periodoInicio}
                  onChange={(event) => setPeriodoInicio(event.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="periodo_fim" className="text-xs">
                  Até:
                </Label>
                <Input
                  id="periodo_fim"
                  type="date"
                  value={periodoFim}
                  onChange={(event) => setPeriodoFim(event.target.value)}
                  className="w-40"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAplicarPeriodo}
                disabled={isPending || !periodoInicio || !periodoFim}
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <RelatorioMeiButton ano={ano} mes={mes} />
          <NovaParcelaDialog matriculas={matriculas} onCriada={recarregar} />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setKpisVisiveis((atual) => !atual)}>
            {kpisVisiveis ? <Eye /> : <EyeOff />}
            {kpisVisiveis ? "Ocultar valores" : "Mostrar valores"}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <KpiCard
            label="A receber"
            valor={kpisVisiveis ? formatValor(dados.kpis.totalReceber) : VALOR_OCULTO}
            cor="amber"
          />
          <KpiCard
            label="Recebido no mês"
            valor={kpisVisiveis ? formatValor(dados.kpis.totalRecebido) : VALOR_OCULTO}
            cor="green"
          />
          <KpiCard
            label="Em atraso"
            valor={kpisVisiveis ? formatValor(dados.kpis.totalAtrasado) : VALOR_OCULTO}
            cor="red"
            sublabel={`${dados.kpis.countAtrasado} parcela(s)`}
          />
          <KpiCard
            label="Adimplência"
            valor={adimplencia === null ? "—" : `${adimplencia.toFixed(0)}%`}
            cor="blue"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por aluno..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-sm"
        />
        <Select
          items={STATUS_FILTRO_ITEMS}
          value={statusFiltro}
          onValueChange={(value) => setStatusFiltro(value as string)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(STATUS_FILTRO_ITEMS).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_FILTRO_ITEMS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selecionadas.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm">
              {selecionadas.size} parcela{selecionadas.size > 1 ? "s" : ""} selecionada
              {selecionadas.size > 1 ? "s" : ""}
            </span>
            {quantidadeSemFatura > 0 && (
              <span className="text-muted-foreground text-xs">
                {quantidadeSemFatura} parcela{quantidadeSemFatura > 1 ? "s" : ""} não{" "}
                {quantidadeSemFatura > 1 ? "têm" : "tem"} cobrança gerada no Asaas e não{" "}
                {quantidadeSemFatura > 1 ? "serão incluídas" : "será incluída"} no carnê.
              </span>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleGerarCarne}
            disabled={gerandoCarne || parcelasComFatura.length === 0}
          >
            <Printer />
            {gerandoCarne ? "Gerando..." : "Gerar carnê"}
          </Button>
        </div>
      )}

      {parcelasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {modoFiltro === "periodo" && periodoInicio && periodoFim
            ? `Nenhuma parcela encontrada entre ${formatDataBR(periodoInicio)} e ${formatDataBR(periodoFim)}.`
            : `Nenhuma parcela encontrada para ${NOMES_MES[mes - 1]} de ${ano}.`}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={todasVisiveisSelecionadas}
                  onCheckedChange={toggleTodasVisiveis}
                  aria-label="Selecionar todas as parcelas visíveis"
                />
              </TableHead>
              <TableHead>Aluno</TableHead>
              <TableHead>Curso/Turma</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Forma de pagamento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelasFiltradas.map((parcela) => (
              <TableRow key={parcela.id}>
                <TableCell>
                  <Checkbox
                    checked={selecionadas.has(parcela.id)}
                    onCheckedChange={() => toggleParcela(parcela.id)}
                    aria-label={`Selecionar parcela de ${parcela.alunos?.full_name ?? "aluno"}`}
                  />
                </TableCell>
                <TableCell>{parcela.alunos?.full_name ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{parcela.matriculas?.turmas?.cursos?.nome ?? "—"}</span>
                    <span className="text-muted-foreground text-xs">
                      {parcela.matriculas?.turmas?.nome ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {parcela.numero_parcela}/{parcela.matriculas?.num_parcelas ?? "?"}
                </TableCell>
                <TableCell>{formatDataBR(parcela.data_vencimento)}</TableCell>
                <TableCell>{formatValor(Number(parcela.valor))}</TableCell>
                <TableCell>
                  <Badge className={PARCELA_STATUS_BADGE_CLASS[parcela.status]}>
                    {PARCELA_STATUS_LABELS[parcela.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {parcela.forma_pagamento ? FORMA_PAGAMENTO_LABELS[parcela.forma_pagamento] : "—"}
                </TableCell>
                <TableCell>
                  <AcoesParcela parcela={parcela} onAtualizada={recarregar} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Paginacao
        paginaAtual={pagina}
        totalPaginas={calcularTotalPaginas(dados.totalParcelas, limite)}
        totalRegistros={dados.totalParcelas}
        limite={limite}
        onNavigate={handlePaginar}
      />
    </div>
  );
}
