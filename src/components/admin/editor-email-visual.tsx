"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ALINHAMENTO_LABELS,
  ALINHAMENTOS,
  CORES_BOTAO_PREDEFINIDAS,
  ESPACO_LABELS,
  ESPACOS,
  LARGURA_IMAGEM_LABELS,
  LARGURAS_IMAGEM,
  novoBloco,
  TAMANHO_TITULO_LABELS,
  TAMANHOS_TITULO,
  TIPO_BLOCO_LABELS,
  TIPOS_BLOCO,
  type AlturaEspaco,
  type BlocoEmail,
  type TipoBloco,
} from "@/lib/email/blocos-email";
import { EMAIL_ASSET_MAXIMO_BYTES, EMAIL_ASSET_TIPOS_ACEITOS, EMAIL_ASSETS_BUCKET } from "@/lib/storage/email-assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function CabecalhoBloco({
  tipo,
  podeSubirDescer,
  onSubir,
  onDescer,
  onRemover,
}: {
  tipo: TipoBloco;
  podeSubirDescer: { subir: boolean; descer: boolean };
  onSubir: () => void;
  onDescer: () => void;
  onRemover: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b pb-2">
      <span className="text-sm font-semibold">{TIPO_BLOCO_LABELS[tipo]}</span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" disabled={!podeSubirDescer.subir} onClick={onSubir} aria-label="Mover pra cima">
          <ArrowUp className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={!podeSubirDescer.descer} onClick={onDescer} aria-label="Mover pra baixo">
          <ArrowDown className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemover} aria-label="Remover bloco">
          <Trash2 className="text-destructive size-4" />
        </Button>
      </div>
    </div>
  );
}

function AlinhamentoSelect({ valor, onChange }: { valor: string; onChange: (valor: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Alinhamento</Label>
      <Select items={ALINHAMENTO_LABELS} value={valor} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALINHAMENTOS.map((a) => (
            <SelectItem key={a} value={a}>
              {ALINHAMENTO_LABELS[a]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BlocoEditor({ bloco, onChange }: { bloco: BlocoEmail; onChange: (bloco: BlocoEmail) => void }) {
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (bloco.tipo !== "imagem") return;
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setErro(null);
    if (!(EMAIL_ASSET_TIPOS_ACEITOS as readonly string[]).includes(file.type)) {
      setErro("Formato não aceito. Use JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > EMAIL_ASSET_MAXIMO_BYTES) {
      setErro("Arquivo muito grande. Máximo permitido: 5MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(EMAIL_ASSETS_BUCKET).upload(path, file);
      if (uploadError) {
        setErro("Não foi possível enviar a imagem. Tente novamente.");
        return;
      }
      const { data } = supabase.storage.from(EMAIL_ASSETS_BUCKET).getPublicUrl(path);
      onChange({ ...bloco, url: data.publicUrl });
    } finally {
      setEnviando(false);
    }
  }

  switch (bloco.tipo) {
    case "titulo":
      return (
        <div className="flex flex-col gap-3">
          <Input value={bloco.texto} onChange={(e) => onChange({ ...bloco, texto: e.target.value })} placeholder="Texto do título" />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Tamanho</Label>
              <Select
                items={TAMANHO_TITULO_LABELS}
                value={bloco.tamanho}
                onValueChange={(v) => v && onChange({ ...bloco, tamanho: v as typeof bloco.tamanho })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAMANHOS_TITULO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TAMANHO_TITULO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlinhamentoSelect valor={bloco.alinhamento} onChange={(v) => onChange({ ...bloco, alinhamento: v as typeof bloco.alinhamento })} />
          </div>
        </div>
      );
    case "texto":
      return (
        <div className="flex flex-col gap-3">
          <Textarea rows={4} value={bloco.texto} onChange={(e) => onChange({ ...bloco, texto: e.target.value })} />
          <AlinhamentoSelect valor={bloco.alinhamento} onChange={(v) => onChange({ ...bloco, alinhamento: v as typeof bloco.alinhamento })} />
        </div>
      );
    case "imagem":
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              value={bloco.url}
              onChange={(e) => onChange({ ...bloco, url: e.target.value })}
              placeholder="URL da imagem (ou envie um arquivo)"
            />
            <input ref={inputFotoRef} type="file" accept={EMAIL_ASSET_TIPOS_ACEITOS.join(",")} className="hidden" onChange={handleUpload} />
            <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={() => inputFotoRef.current?.click()}>
              <Upload className="size-4" />
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          </div>
          {erro && <p className="text-destructive text-xs">{erro}</p>}
          {bloco.url && (
            // eslint-disable-next-line @next/next/no-img-element -- preview de uma URL arbitrária (upload ou externa), não um asset do projeto
            <img src={bloco.url} alt="" className="h-20 w-auto rounded border object-contain" />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Largura</Label>
              <Select
                items={LARGURA_IMAGEM_LABELS}
                value={bloco.largura}
                onValueChange={(v) => v && onChange({ ...bloco, largura: v as typeof bloco.largura })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LARGURAS_IMAGEM.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LARGURA_IMAGEM_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlinhamentoSelect valor={bloco.alinhamento} onChange={(v) => onChange({ ...bloco, alinhamento: v as typeof bloco.alinhamento })} />
          </div>
        </div>
      );
    case "botao":
      return (
        <div className="flex flex-col gap-3">
          <Input value={bloco.texto} onChange={(e) => onChange({ ...bloco, texto: e.target.value })} placeholder="Texto do botão" />
          <Input value={bloco.url} onChange={(e) => onChange({ ...bloco, url: e.target.value })} placeholder="URL de destino" />
          <div className="flex flex-col gap-1.5">
            <Label>Cor de fundo</Label>
            <div className="flex items-center gap-2">
              {CORES_BOTAO_PREDEFINIDAS.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => onChange({ ...bloco, cor })}
                  aria-label={`Cor ${cor}`}
                  className={`size-7 rounded-full border-2 ${bloco.cor === cor ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: cor }}
                />
              ))}
              <Input
                type="color"
                value={bloco.cor}
                onChange={(e) => onChange({ ...bloco, cor: e.target.value })}
                className="h-8 w-12 cursor-pointer p-1"
              />
            </div>
          </div>
        </div>
      );
    case "divisor":
      return <p className="text-muted-foreground text-sm">Linha horizontal simples — sem configurações.</p>;
    case "espaco":
      return (
        <div className="flex flex-col gap-1.5">
          <Label>Altura</Label>
          <Select
            items={Object.fromEntries(ESPACOS.map((e) => [e, ESPACO_LABELS[e]]))}
            value={String(bloco.altura)}
            onValueChange={(v) => v && onChange({ ...bloco, altura: Number(v) as AlturaEspaco })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESPACOS.map((e) => (
                <SelectItem key={e} value={String(e)}>
                  {ESPACO_LABELS[e]} ({e}px)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
  }
}

export function EditorEmailVisual({ blocos, onChange }: { blocos: BlocoEmail[]; onChange: (blocos: BlocoEmail[]) => void }) {
  function atualizarBloco(indice: number, bloco: BlocoEmail) {
    onChange(blocos.map((b, i) => (i === indice ? bloco : b)));
  }

  function moverBloco(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= blocos.length) return;
    const copia = [...blocos];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    onChange(copia);
  }

  function removerBloco(indice: number) {
    onChange(blocos.filter((_, i) => i !== indice));
  }

  function adicionarBloco(tipo: TipoBloco) {
    onChange([...blocos, novoBloco(tipo)]);
  }

  return (
    <div className="flex flex-col gap-3">
      {blocos.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">Nenhum bloco ainda — adicione um abaixo.</p>
      )}
      {blocos.map((bloco, indice) => (
        <Card key={bloco.id}>
          <CardContent className="flex flex-col gap-3">
            <CabecalhoBloco
              tipo={bloco.tipo}
              podeSubirDescer={{ subir: indice > 0, descer: indice < blocos.length - 1 }}
              onSubir={() => moverBloco(indice, -1)}
              onDescer={() => moverBloco(indice, 1)}
              onRemover={() => removerBloco(indice)}
            />
            <BlocoEditor bloco={bloco} onChange={(novo) => atualizarBloco(indice, novo)} />
          </CardContent>
        </Card>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" className="w-fit border-dashed" />}>
          <Plus />
          Adicionar bloco
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TIPOS_BLOCO.map((tipo) => (
            <DropdownMenuItem key={tipo} onClick={() => adicionarBloco(tipo)}>
              {TIPO_BLOCO_LABELS[tipo]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
