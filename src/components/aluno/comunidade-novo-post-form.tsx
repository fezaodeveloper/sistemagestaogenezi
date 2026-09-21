"use client";

// "use client": estado do formulário (select, contadores) e Server Action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarPost } from "@/app/aluno/comunidade/actions";
import { LIMITE_CONTEUDO_POST, LIMITE_TITULO } from "@/lib/comunidade/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type CategoriaOpcao = { id: string; nome: string; icone: string };

export function ComunidadeNovoPostForm({
  categorias,
  categoriaInicialId,
}: {
  categorias: CategoriaOpcao[];
  categoriaInicialId: string | null;
}) {
  const router = useRouter();
  const [categoriaId, setCategoriaId] = useState(categoriaInicialId ?? "");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  // `items` faz o trigger mostrar o nome (e não o id) já com valor inicial preenchido.
  const itens: Record<string, string> = Object.fromEntries(categorias.map((c) => [c.id, `${c.icone} ${c.nome}`]));

  function publicar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    if (!categoriaId) {
      setErro("Escolha uma categoria.");
      return;
    }
    startTransition(async () => {
      const r = await criarPost({ categoriaId, titulo, conteudo });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      router.push(`/aluno/comunidade/post/${r.postId}`);
    });
  }

  return (
    <form onSubmit={publicar} className="flex flex-col gap-5">
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
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={LIMITE_TITULO}
          placeholder="Resuma o assunto em uma frase"
          disabled={pendente}
          required
        />
        <span className="text-muted-foreground text-xs">
          {titulo.length}/{LIMITE_TITULO}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="conteudo">Conteúdo</Label>
        <Textarea
          id="conteudo"
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          maxLength={LIMITE_CONTEUDO_POST}
          rows={10}
          placeholder="Escreva sua mensagem..."
          disabled={pendente}
          required
        />
        <span className="text-muted-foreground text-xs">
          {conteudo.length}/{LIMITE_CONTEUDO_POST}
        </span>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pendente || !titulo.trim() || !conteudo.trim() || !categoriaId}>
          {pendente ? "Publicando..." : "Publicar"}
        </Button>
        <Button type="button" variant="outline" disabled={pendente} onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
