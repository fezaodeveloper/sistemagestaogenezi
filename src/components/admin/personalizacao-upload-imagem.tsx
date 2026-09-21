"use client";

// "use client": upload direto ao Storage pelo navegador, preview e Server Actions. Cada campo salva
// SOZINHO ao escolher o arquivo (sem depender do botão "Salvar" do texto/cores).

import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import {
  removerImagemPersonalizacao,
  salvarImagemPersonalizacao,
} from "@/app/admin/configuracoes/personalizacao/actions";
import { createClient } from "@/lib/supabase/client";
import { CAMPOS_IMAGEM, type CampoImagem } from "@/lib/personalizacao/campos";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function tipoDoArquivo(arquivo: File): string {
  // Alguns sistemas não informam o MIME de .ico.
  if (!arquivo.type && arquivo.name.toLowerCase().endsWith(".ico")) return "image/x-icon";
  return arquivo.type;
}

function lerDimensoes(arquivo: File): Promise<{ largura: number; altura: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      resolve({ largura: img.naturalWidth, altura: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("imagem ilegível"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function formatarTamanho(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function PersonalizacaoUploadImagem({
  campo,
  urlInicial,
  onAlterou,
}: {
  campo: CampoImagem;
  urlInicial: string | null;
  onAlterou?: (campo: CampoImagem, url: string | null) => void;
}) {
  const def = CAMPOS_IMAGEM[campo];
  const [url, setUrl] = useState(urlInicial);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ocupado = enviando || removendo;

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    evento.target.value = "";
    if (!arquivo) return;
    setErro(null);

    const tipo = tipoDoArquivo(arquivo);
    const extensao = def.tipos[tipo];
    if (!extensao) {
      const aceitos = Array.from(new Set(Object.values(def.tipos))).join(", ").toUpperCase();
      setErro(`Formato não aceito. Use ${aceitos}.`);
      return;
    }
    if (arquivo.size > def.maxBytes) {
      setErro(`Arquivo muito grande. Máximo: ${formatarTamanho(def.maxBytes)}.`);
      return;
    }
    if (def.dimensao) {
      try {
        const { largura, altura } = await lerDimensoes(arquivo);
        if (largura !== def.dimensao.largura || altura !== def.dimensao.altura) {
          setErro(`A imagem tem ${largura}x${altura} px. Envie exatamente ${def.dimensao.largura}x${def.dimensao.altura} px.`);
          return;
        }
      } catch {
        setErro("Não foi possível ler a imagem. Tente outro arquivo.");
        return;
      }
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      // Nome fixo por campo + upsert (sem acúmulo de arquivos), ou nome com carimbo de data.
      const caminho = def.nomeFixo
        ? `${def.pasta}${def.arquivo}.${extensao}`
        : `${def.pasta}${def.arquivo}-${Date.now()}.${extensao}`;
      const { error: erroUpload } = await supabase.storage.from(def.bucket).upload(caminho, arquivo, {
        cacheControl: "3600",
        contentType: tipo,
        upsert: def.nomeFixo,
      });
      if (erroUpload) {
        setErro(`Erro no upload: ${erroUpload.message}`);
        return;
      }

      const publica = supabase.storage.from(def.bucket).getPublicUrl(caminho).data.publicUrl;
      // Nome fixo mantém a mesma URL entre envios: o ?v= evita mostrar a imagem antiga em cache.
      const novaUrl = def.nomeFixo ? `${publica}?v=${Date.now()}` : publica;

      const resultado = await salvarImagemPersonalizacao(campo, novaUrl);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setUrl(novaUrl);
      onAlterou?.(campo, novaUrl);
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    setErro(null);
    setRemovendo(true);
    try {
      const resultado = await removerImagemPersonalizacao(campo);
      if ("error" in resultado) {
        setErro(resultado.error);
        setConfirmando(false);
        return;
      }
      setUrl(null);
      setConfirmando(false);
      onAlterou?.(campo, null);
    } finally {
      setRemovendo(false);
    }
  }

  const aceitar = Object.keys(def.tipos).join(",") + (def.tipos["image/x-icon"] ? ",.ico" : "");

  return (
    <div className="flex flex-wrap items-start gap-4">
      <input ref={inputRef} type="file" accept={aceitar} onChange={aoEscolher} className="hidden" />

      {/* Preview ao lado: fundo claro/escuro conforme o tema a que a imagem se destina. */}
      <div
        className={`flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border p-2 ${
          def.fundo === "escuro" ? "bg-[#0f172a]" : "bg-white"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem do Storage do próprio projeto
          <img src={url} alt={def.rotulo} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={`text-xs ${def.fundo === "escuro" ? "text-slate-400" : "text-slate-500"}`}>Sem imagem</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{def.rotulo}</span>
          {def.nota && <span className="text-muted-foreground text-xs">{def.nota}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => inputRef.current?.click()}>
            <Upload />
            {enviando ? "Enviando..." : url ? "Trocar" : "Enviar"}
          </Button>
          {url && (
            <Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => setConfirmando(true)}>
              <Trash2 />
              Remover
            </Button>
          )}
        </div>

        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
      </div>

      <AlertDialog open={confirmando} onOpenChange={(aberto) => !removendo && setConfirmando(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {def.rotulo.toLowerCase()}</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo é apagado (se nenhum outro campo o usar) e o sistema volta ao padrão nesse ponto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={removendo} onClick={remover}>
              {removendo ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
