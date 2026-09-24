"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import {
  listarAvaliacoesDaAula,
  type AvaliacaoIndividualView,
} from "@/app/admin/academico/avaliacoes/actions";
import { AvaliacaoEstrelas } from "@/components/admin/avaliacao-estrelas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularTotalPaginas, LIMITE_PADRAO } from "@/lib/paginacao";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AvaliacaoDetalhesDialog({
  aulaId,
  aulaTitulo,
  media,
  totalAvaliacoes,
}: {
  aulaId: string;
  aulaTitulo: string;
  media: number;
  totalAvaliacoes: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);
  const [itens, setItens] = useState<AvaliacaoIndividualView[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(LIMITE_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function carregar(novaPagina: number, novoLimite: number) {
    setErro(null);
    startTransition(async () => {
      const resultado = await listarAvaliacoesDaAula(aulaId, String(novaPagina), String(novoLimite));
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      setItens(resultado.itens);
      setTotal(resultado.total);
      setPagina(novaPagina);
      setLimite(novoLimite);
      setCarregouUmaVez(true);
    });
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        setAberto(open);
        if (open && !carregouUmaVez) carregar(1, LIMITE_PADRAO);
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Eye />
            Ver detalhes
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{aulaTitulo}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <AvaliacaoEstrelas nota={media} tamanho="md" />
          <span className="text-sm font-medium">{media.toFixed(1)}</span>
          <span className="text-muted-foreground text-sm">
            ({totalAvaliacoes} avaliaç{totalAvaliacoes === 1 ? "ão" : "ões"})
          </span>
        </div>

        {erro ? (
          <p className="text-destructive py-6 text-center text-sm">{erro}</p>
        ) : isPending && !carregouUmaVez ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Carregando…</p>
        ) : itens.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nenhuma avaliação encontrada.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {itens.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{item.alunoNome}</span>
                  <span className="text-muted-foreground text-xs">{formatarData(item.createdAt)}</span>
                </div>
                <AvaliacaoEstrelas nota={item.nota} />
                {item.comentario && <p className="text-sm">{item.comentario}</p>}
              </div>
            ))}

            <Paginacao
              paginaAtual={pagina}
              totalPaginas={calcularTotalPaginas(total, limite)}
              totalRegistros={total}
              limite={limite}
              onNavigate={carregar}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
