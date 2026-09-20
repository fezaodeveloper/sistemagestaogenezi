"use client";

// "use client": diálogos de confirmação/consulta e Server Actions da nota fiscal.

import { useState, useTransition } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { consultarNotaParcela, emitirNotaParcela } from "@/app/admin/financeiro/spedy-actions";
import { formatCpf } from "@/lib/alunos/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Resultado = { status: string; numeroNota: number | null; mensagem?: string | null };

// Nota fiscal (NFS-e) da Spedy de UMA parcela paga:
//  - sem nota: botão "Emitir NF" -> confirmação com os dados da nota -> emite;
//  - com nota: selo + "Ver status" (a Spedy emite de forma assíncrona: o número da
//    nota só aparece depois que a prefeitura autoriza).
export function SpedyNotaParcela({
  parcelaId,
  notaId,
  spedyAtivo,
  alunoNome,
  alunoCpf,
  cursoNome,
  valor,
  onAtualizada,
}: {
  parcelaId: string;
  notaId: string | null;
  // Existe integração Spedy ativa (sem ela não dá pra emitir).
  spedyAtivo: boolean;
  alunoNome: string;
  alunoCpf: string | null;
  cursoNome: string;
  valor: number;
  onAtualizada: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [emitindo, startEmitir] = useTransition();
  const [buscando, startBuscar] = useTransition();

  function emitir() {
    setErro(null);
    startEmitir(async () => {
      const r = await emitirNotaParcela(parcelaId);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setResultado({ status: r.status, numeroNota: r.numeroNota });
      onAtualizada();
    });
  }

  function consultar() {
    setErro(null);
    setResultado(null);
    startBuscar(async () => {
      const r = await consultarNotaParcela(parcelaId);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setResultado({ status: r.status, numeroNota: r.numeroNota, mensagem: r.mensagem });
    });
  }

  if (!notaId && !spedyAtivo) return null;

  return (
    <>
      {notaId ? (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            NF Spedy
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setConsultando(true);
              consultar();
            }}
          >
            <RefreshCw />
            Ver status
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setErro(null);
            setResultado(null);
            setConfirmando(true);
          }}
        >
          <FileText />
          Emitir NF
        </Button>
      )}

      <Dialog open={confirmando} onOpenChange={(aberto) => !emitindo && setConfirmando(aberto)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{resultado ? "Nota enviada" : "Emitir nota fiscal"}</DialogTitle>
            <DialogDescription>
              {resultado ? "A Spedy recebeu a nota." : "Confira os dados antes de emitir a NFS-e pela Spedy."}
            </DialogDescription>
          </DialogHeader>

          <dl className="bg-muted/50 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md p-3 text-sm">
            <dt className="text-muted-foreground">Aluno</dt>
            <dd className="font-medium">{alunoNome}</dd>
            <dt className="text-muted-foreground">CPF</dt>
            <dd>{alunoCpf ? formatCpf(alunoCpf) : "—"}</dd>
            <dt className="text-muted-foreground">Curso</dt>
            <dd>{cursoNome}</dd>
            <dt className="text-muted-foreground">Valor</dt>
            <dd className="font-medium">{REAIS.format(valor)}</dd>
          </dl>

          {resultado && (
            <p role="status" className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              Status: <strong>{resultado.status}</strong>.{" "}
              {resultado.numeroNota !== null
                ? `Número da nota: ${resultado.numeroNota}.`
                : "O número aparece quando a prefeitura autorizar — use “Ver status” daqui a pouco."}
            </p>
          )}
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)} disabled={emitindo}>
              {resultado ? "Fechar" : "Cancelar"}
            </Button>
            {!resultado && (
              <Button type="button" onClick={emitir} disabled={emitindo}>
                {emitindo ? "Emitindo..." : "Emitir nota"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={consultando} onOpenChange={setConsultando}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nota fiscal (Spedy)</DialogTitle>
            <DialogDescription>Situação atual da nota na Spedy.</DialogDescription>
          </DialogHeader>
          {buscando ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Consultando...</p>
          ) : erro ? (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          ) : resultado ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                Status: <strong>{resultado.status}</strong>
              </p>
              <p>
                Número da nota:{" "}
                <strong>{resultado.numeroNota !== null ? resultado.numeroNota : "ainda não atribuído"}</strong>
              </p>
              {resultado.mensagem && <p className="text-muted-foreground text-xs">{resultado.mensagem}</p>}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={consultar} disabled={buscando}>
              <RefreshCw />
              Atualizar
            </Button>
            <Button type="button" onClick={() => setConsultando(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
