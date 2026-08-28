"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditorTextoCertificado } from "@/components/admin/editor-texto-certificado";
import {
  LOGO_POSICAO_LABELS,
  LOGO_POSICOES,
  LOGO_TAMANHO_LABELS,
  LOGO_TAMANHOS,
  type LogoPosicao,
  type LogoTamanho,
  type MargensTexto,
} from "@/lib/certificados/schema";
import { TAMANHO_FONTE_PADRAO, tiptapJsonParaRuns, VARIAVEIS_EXEMPLO } from "@/lib/certificados/texto";
import type { TemplateFormState } from "@/app/admin/certificados/template/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar template"}
    </Button>
  );
}

const LOGO_POSICAO_CLASSES: Record<LogoPosicao, string> = {
  topo_centro: "top-3 left-1/2 -translate-x-1/2",
  superior_esquerdo: "top-3 left-3",
  superior_direito: "top-3 right-3",
  sem_logo: "hidden",
};

const LOGO_TAMANHO_CLASSES: Record<LogoTamanho, string> = {
  pequeno: "h-8",
  medio: "h-12",
  grande: "h-16",
};

function usePreviewUpload(atualUrl: string | null) {
  const [preview, setPreview] = useState<string | null>(atualUrl);
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(arquivo ? URL.createObjectURL(arquivo) : atualUrl);
  }
  return { preview, onChange };
}

// 4 campos de margem (superior/inferior/esquerda/direita, em % da
// página), reaproveitado pra frente e verso — mesma ideia de caixa de
// texto delimitada calculada em pdf.ts (calcularCaixaTexto).
function CamposMargem({
  prefixo,
  margens,
  onChange,
}: {
  prefixo: string;
  margens: MargensTexto;
  onChange: (margens: MargensTexto) => void;
}) {
  function campo(chave: keyof MargensTexto, label: string) {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${prefixo}_margem_${chave}`} className="text-muted-foreground text-xs">
          {label}
        </Label>
        <Input
          id={`${prefixo}_margem_${chave}`}
          name={`${prefixo}_margem_${chave}`}
          type="number"
          min={0}
          max={100}
          value={margens[chave]}
          onChange={(e) => onChange({ ...margens, [chave]: Number(e.target.value) })}
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 gap-2">
      {campo("superior", "Superior %")}
      {campo("inferior", "Inferior %")}
      {campo("esquerda", "Esquerda %")}
      {campo("direita", "Direita %")}
    </div>
  );
}

export function CertificadoTemplateForm({
  action,
  defaultValues,
  fundoFrenteAtualUrl,
  fundoVersoAtualUrl,
  logoAtualUrl,
  assinaturaAtualUrl,
}: {
  action: (state: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  defaultValues: {
    logo_posicao: LogoPosicao;
    logo_tamanho: LogoTamanho;
    cidade_emissao: string;
    estado_emissao: string;
    texto_frente: JSONContent;
    texto_verso: JSONContent;
    texto_frente_margens: MargensTexto;
    texto_verso_margens: MargensTexto;
    cor_texto_frente: string;
    cor_texto_verso: string;
    assinatura_x_percentual: number;
    assinatura_y_percentual: number;
    assinatura_largura_px: number;
  };
  fundoFrenteAtualUrl: string | null;
  fundoVersoAtualUrl: string | null;
  logoAtualUrl: string | null;
  assinaturaAtualUrl: string | null;
}) {
  const [state, formAction] = useActionState<TemplateFormState, FormData>(action, undefined);

  const fundoFrente = usePreviewUpload(fundoFrenteAtualUrl);
  const fundoVerso = usePreviewUpload(fundoVersoAtualUrl);
  const logo = usePreviewUpload(logoAtualUrl);
  const assinatura = usePreviewUpload(assinaturaAtualUrl);
  const [imagemFrenteLargura, setImagemFrenteLargura] = useState<number | null>(null);
  const [imagemVersoLargura, setImagemVersoLargura] = useState<number | null>(null);

  const [logoPosicao, setLogoPosicao] = useState<LogoPosicao>(defaultValues.logo_posicao);
  const [logoTamanho, setLogoTamanho] = useState<LogoTamanho>(defaultValues.logo_tamanho);
  const [textoFrenteJson, setTextoFrenteJson] = useState<JSONContent>(defaultValues.texto_frente);
  const [textoVersoJson, setTextoVersoJson] = useState<JSONContent>(defaultValues.texto_verso);
  const [margensFrente, setMargensFrente] = useState<MargensTexto>(defaultValues.texto_frente_margens);
  const [margensVerso, setMargensVerso] = useState<MargensTexto>(defaultValues.texto_verso_margens);
  const [corTextoFrente, setCorTextoFrente] = useState(defaultValues.cor_texto_frente);
  const [corTextoVerso, setCorTextoVerso] = useState(defaultValues.cor_texto_verso);
  const [assinaturaX, setAssinaturaX] = useState(defaultValues.assinatura_x_percentual);
  const [assinaturaY, setAssinaturaY] = useState(defaultValues.assinatura_y_percentual);
  const [assinaturaLargura, setAssinaturaLargura] = useState(defaultValues.assinatura_largura_px);
  const [ladoPreview, setLadoPreview] = useState<"frente" | "verso">("frente");

  const linhasFrente = tiptapJsonParaRuns(textoFrenteJson, VARIAVEIS_EXEMPLO);
  const linhasVerso = tiptapJsonParaRuns(textoVersoJson, VARIAVEIS_EXEMPLO);
  const fundoPreviewAtual = ladoPreview === "frente" ? fundoFrente.preview : fundoVerso.preview;
  const linhasPreviewAtual = ladoPreview === "frente" ? linhasFrente : linhasVerso;
  const margensPreviewAtual = ladoPreview === "frente" ? margensFrente : margensVerso;
  const corTextoAtual = ladoPreview === "frente" ? corTextoFrente : corTextoVerso;
  const imagemLarguraAtual = ladoPreview === "frente" ? imagemFrenteLargura : imagemVersoLargura;

  // Largura da assinatura é um valor absoluto (px) relativo ao pixel real
  // da imagem de fundo — na prévia (exibida bem menor que o arquivo
  // original) convertemos pra % da largura natural da imagem carregada,
  // senão ficaria desproporcional na tela.
  const assinaturaLarguraPercentual = imagemFrenteLargura
    ? (assinaturaLargura / imagemFrenteLargura) * 100
    : 12;

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <form action={formAction} encType="multipart/form-data" className="flex max-w-xl flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fundo_frente">Imagem de fundo — frente</Label>
          {fundoFrente.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou imagem já enviada em bucket público
            <img
              src={fundoFrente.preview}
              alt="Prévia do fundo da frente"
              className="w-full max-w-sm rounded-lg border object-contain"
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex aspect-video w-full max-w-sm items-center justify-center rounded-lg border text-xs">
              Sem imagem de fundo
            </div>
          )}
          <Input
            id="fundo_frente"
            name="fundo_frente"
            type="file"
            accept="image/jpeg,image/png"
            onChange={fundoFrente.onChange}
          />
          {state?.errors?.fundo_frente && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.fundo_frente[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fundo_verso">Imagem de fundo — verso</Label>
          {fundoVerso.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou imagem já enviada em bucket público
            <img
              src={fundoVerso.preview}
              alt="Prévia do fundo do verso"
              className="w-full max-w-sm rounded-lg border object-contain"
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex aspect-video w-full max-w-sm items-center justify-center rounded-lg border text-xs">
              Sem imagem de fundo
            </div>
          )}
          <Input
            id="fundo_verso"
            name="fundo_verso"
            type="file"
            accept="image/jpeg,image/png"
            onChange={fundoVerso.onChange}
          />
          <p className="text-muted-foreground text-xs">
            JPEG ou PNG, até 5MB cada. O PDF sai com 2 páginas, cada uma no tamanho da respectiva
            imagem de fundo.
          </p>
          {state?.errors?.fundo_verso && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.fundo_verso[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="assinatura">Assinatura (opcional)</Label>
          {assinatura.preview && (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou imagem já enviada em bucket público
            <img
              src={assinatura.preview}
              alt="Prévia da assinatura"
              className="h-16 w-auto rounded border object-contain"
            />
          )}
          <Input
            id="assinatura"
            name="assinatura"
            type="file"
            accept="image/jpeg,image/png"
            onChange={assinatura.onChange}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="assinatura_x_percentual" className="text-muted-foreground text-xs">
                Posição X %
              </Label>
              <Input
                id="assinatura_x_percentual"
                name="assinatura_x_percentual"
                type="number"
                min={0}
                max={100}
                value={assinaturaX}
                onChange={(e) => setAssinaturaX(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="assinatura_y_percentual" className="text-muted-foreground text-xs">
                Posição Y %
              </Label>
              <Input
                id="assinatura_y_percentual"
                name="assinatura_y_percentual"
                type="number"
                min={0}
                max={100}
                value={assinaturaY}
                onChange={(e) => setAssinaturaY(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="assinatura_largura_px" className="text-muted-foreground text-xs">
                Largura (px)
              </Label>
              <Input
                id="assinatura_largura_px"
                name="assinatura_largura_px"
                type="number"
                min={1}
                value={assinaturaLargura}
                onChange={(e) => setAssinaturaLargura(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            X/Y marcam o centro da assinatura, em % da página (0% = topo/esquerda, 100% =
            base/direita). Largura em pixels da imagem de fundo da frente; a altura acompanha
            proporcionalmente.
          </p>
          {state?.errors?.assinatura && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.assinatura[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="logo">Logo (opcional)</Label>
          {logo.preview && (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou imagem já enviada em bucket público
            <img
              src={logo.preview}
              alt="Prévia do logo"
              className="h-16 w-auto rounded border object-contain"
            />
          )}
          <Input id="logo" name="logo" type="file" accept="image/jpeg,image/png" onChange={logo.onChange} />
          {state?.errors?.logo && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.logo[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="logo_posicao">Posição do logo</Label>
          <Select
            name="logo_posicao"
            items={LOGO_POSICAO_LABELS}
            value={logoPosicao}
            onValueChange={(v) => setLogoPosicao(v as LogoPosicao)}
          >
            <SelectTrigger id="logo_posicao" className="w-full">
              <SelectValue placeholder="Selecione a posição" />
            </SelectTrigger>
            <SelectContent>
              {LOGO_POSICOES.map((posicao) => (
                <SelectItem key={posicao} value={posicao}>
                  {LOGO_POSICAO_LABELS[posicao]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="logo_tamanho">Tamanho do logo</Label>
          <Select
            name="logo_tamanho"
            items={LOGO_TAMANHO_LABELS}
            value={logoTamanho}
            onValueChange={(v) => setLogoTamanho(v as LogoTamanho)}
          >
            <SelectTrigger id="logo_tamanho" className="w-full">
              <SelectValue placeholder="Selecione o tamanho" />
            </SelectTrigger>
            <SelectContent>
              {LOGO_TAMANHOS.map((tamanho) => (
                <SelectItem key={tamanho} value={tamanho}>
                  {LOGO_TAMANHO_LABELS[tamanho]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cidade_emissao">Cidade de emissão</Label>
            <Input
              id="cidade_emissao"
              name="cidade_emissao"
              defaultValue={defaultValues.cidade_emissao}
              placeholder="Ex.: São Paulo"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado_emissao">Estado de emissão</Label>
            <Input
              id="estado_emissao"
              name="estado_emissao"
              defaultValue={defaultValues.estado_emissao}
              placeholder="Ex.: SP"
            />
          </div>
        </div>
        <p className="text-muted-foreground -mt-3 text-xs">
          Preenche as variáveis {"{cidade}"} e {"{estado}"} — é o endereço da escola, não o do
          aluno, e vale pra todo certificado emitido.
        </p>

        <div className="flex flex-col gap-2">
          <Label>Texto — frente</Label>
          <EditorTextoCertificado
            name="texto_frente"
            content={defaultValues.texto_frente}
            onChangeJson={setTextoFrenteJson}
          />
          {state?.errors?.texto_frente && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.texto_frente[0]}
            </p>
          )}
          <Label className="text-muted-foreground text-xs">Caixa de texto — frente</Label>
          <CamposMargem prefixo="texto_frente" margens={margensFrente} onChange={setMargensFrente} />
          <div className="flex items-center gap-2">
            <Label htmlFor="cor_texto_frente" className="text-muted-foreground text-xs">
              Cor do texto (frente)
            </Label>
            <Input
              id="cor_texto_frente"
              name="cor_texto_frente"
              type="color"
              className="h-8 w-14 p-1"
              value={corTextoFrente}
              onChange={(e) => setCorTextoFrente(e.target.value)}
            />
          </div>
          {state?.errors?.cor_texto_frente && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.cor_texto_frente[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Texto — verso</Label>
          <EditorTextoCertificado
            name="texto_verso"
            content={defaultValues.texto_verso}
            onChangeJson={setTextoVersoJson}
          />
          {state?.errors?.texto_verso && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.texto_verso[0]}
            </p>
          )}
          <Label className="text-muted-foreground text-xs">Caixa de texto — verso</Label>
          <CamposMargem prefixo="texto_verso" margens={margensVerso} onChange={setMargensVerso} />
          <div className="flex items-center gap-2">
            <Label htmlFor="cor_texto_verso" className="text-muted-foreground text-xs">
              Cor do texto (verso)
            </Label>
            <Input
              id="cor_texto_verso"
              name="cor_texto_verso"
              type="color"
              className="h-8 w-14 p-1"
              value={corTextoVerso}
              onChange={(e) => setCorTextoVerso(e.target.value)}
            />
          </div>
          {state?.errors?.cor_texto_verso && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.cor_texto_verso[0]}
            </p>
          )}
        </div>

        <p className="text-muted-foreground text-xs">
          Variáveis disponíveis: {"{nome_aluno}"}, {"{nome_curso}"}, {"{carga_horaria}"},{" "}
          {"{data_conclusao}"}, {"{data_inicio}"}, {"{cpf}"}, {"{cidade}"}, {"{estado}"},{" "}
          {"{aproveitamento}"}.
        </p>

        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}

        <div>
          <SubmitButton />
        </div>
      </form>

      <div className="flex-1">
        <div className="mb-2 flex items-center justify-between">
          <Label>Prévia</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={ladoPreview === "frente" ? "default" : "outline"}
              onClick={() => setLadoPreview("frente")}
            >
              Frente
            </Button>
            <Button
              type="button"
              size="sm"
              variant={ladoPreview === "verso" ? "default" : "outline"}
              onClick={() => setLadoPreview("verso")}
            >
              Verso
            </Button>
          </div>
        </div>
        <div className="bg-muted @container relative w-full overflow-hidden rounded-lg border">
          {fundoPreviewAtual ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia da montagem final, não passa por upload
            <img
              src={fundoPreviewAtual}
              alt="Prévia do certificado"
              className="block w-full"
              onLoad={(e) => {
                const largura = e.currentTarget.naturalWidth;
                if (ladoPreview === "frente") setImagemFrenteLargura(largura);
                else setImagemVersoLargura(largura);
              }}
            />
          ) : (
            <div className="aspect-video w-full" />
          )}

          {ladoPreview === "frente" && logo.preview && logoPosicao !== "sem_logo" && (
            // eslint-disable-next-line @next/next/no-img-element -- prévia da montagem final, não passa por upload
            <img
              src={logo.preview}
              alt=""
              className={`absolute w-auto object-contain ${LOGO_POSICAO_CLASSES[logoPosicao]} ${LOGO_TAMANHO_CLASSES[logoTamanho]}`}
            />
          )}

          <div
            className="absolute flex items-center justify-center overflow-hidden text-center"
            style={{
              top: `${margensPreviewAtual.superior}%`,
              bottom: `${margensPreviewAtual.inferior}%`,
              left: `${margensPreviewAtual.esquerda}%`,
              right: `${margensPreviewAtual.direita}%`,
            }}
          >
            {/* WYSIWYG: fator de escala = largura exibida da prévia / largura
                real da imagem de fundo (em px), aplicado ao tamanho de
                fonte configurado — "cqw" já é exatamente essa proporção,
                1cqw = 1% da largura do container (@container acima). Sem
                isso, um tamanho de 100px apareceria do mesmo jeito numa
                imagem de 400px de largura ou de 4000px, o que não reflete
                o PDF real (a página nasce no tamanho em pixels da imagem). */}
            <p className="leading-relaxed" style={{ color: corTextoAtual }}>
              {linhasPreviewAtual.map((run, i) => {
                const tamanho = run.tamanhoFonte ?? TAMANHO_FONTE_PADRAO;
                const fontSizeCqw = imagemLarguraAtual ? (tamanho / imagemLarguraAtual) * 100 : null;
                return (
                  <span
                    key={i}
                    className={`${run.negrito ? "font-bold" : ""} ${run.sublinhado ? "underline" : ""}`}
                    style={fontSizeCqw ? { fontSize: `${fontSizeCqw}cqw` } : undefined}
                  >
                    {run.texto}
                  </span>
                );
              })}
            </p>
          </div>

          {ladoPreview === "frente" && assinatura.preview && (
            // eslint-disable-next-line @next/next/no-img-element -- prévia da montagem final, não passa por upload
            <img
              src={assinatura.preview}
              alt=""
              className="absolute object-contain"
              style={{
                left: `${assinaturaX}%`,
                top: `${assinaturaY}%`,
                width: `${assinaturaLarguraPercentual}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Prévia com dados de exemplo — o certificado real usa os dados do aluno e do curso.
        </p>
      </div>
    </div>
  );
}
