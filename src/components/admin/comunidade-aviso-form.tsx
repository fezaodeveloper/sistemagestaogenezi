"use client";

// "use client": estado do formulário e Server Action de publicar como equipe.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publicarPostEquipe } from "@/app/admin/configuracoes/portal-aluno/comunidade/actions";
import { LIMITE_CONTEUDO_POST, LIMITE_TITULO } from "@/lib/comunidade/tipos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type CategoriaAvisoOpcao = { id: string; nome: string; icone: string; somenteAdmin: boolean };

export function ComunidadeAvisoForm({ categorias }: { categorias: CategoriaAvisoOpcao[] }) {
  const router = useRouter();
  // Pré-seleciona a categoria "só equipe" (Avisos), que é o uso mais comum.
  const inicial = categorias.find((c) => c.somenteAdmin)?.id ?? categorias[0]?.id ?? "";
  const [categoriaId, setCategoriaId] = useState(inicial);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [fixado, setFixado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendente, startTransition] = useTransition();

  const itens: Record<string, string> = Object.fromEntries(categorias.map((c) => [c.id, `${c.icone} ${c.nome}`]));

  function publicar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setOk(false);
    startTransition(async () => {
      const r = await publicarPostEquipe({ categoriaId, titulo, conteudo, fixado });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setTitulo("");
      setConteudo("");
      setFixado(false);
      setOk(true);
      router.refresh();
    });
  }

  if (categorias.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          Crie e ative uma categoria para poder publicar como equipe.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-5">
        <form onSubmit={publicar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Categoria</Label>
            <Select items={itens} value={categoriaId} onValueChange={(v) => setCategoriaId(v ?? "")} disabled={pendente}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icone} {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="aviso-titulo">Título</Label>
            <Input
              id="aviso-titulo"
              value={titulo}
              maxLength={LIMITE_TITULO}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={pendente}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="aviso-conteudo">Conteúdo</Label>
            <Textarea
              id="aviso-conteudo"
              value={conteudo}
              maxLength={LIMITE_CONTEUDO_POST}
              rows={5}
              onChange={(e) => setConteudo(e.target.value)}
              disabled={pendente}
            />
            <span className="text-muted-foreground text-xs">
              {conteudo.length}/{LIMITE_CONTEUDO_POST}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="aviso-fixado">Fixar no topo</Label>
            <Switch id="aviso-fixado" checked={fixado} onCheckedChange={setFixado} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pendente || !titulo.trim() || !conteudo.trim() || !categoriaId}>
              {pendente ? "Publicando..." : "Publicar como equipe"}
            </Button>
            {ok && (
              <span role="status" className="text-sm text-green-600 dark:text-green-400">
                Post publicado.
              </span>
            )}
            {erro && (
              <span role="alert" className="text-destructive text-sm">
                {erro}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
