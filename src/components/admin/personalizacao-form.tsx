"use client";

// "use client": estado dos campos de texto/cor, Server Actions e diálogo de confirmação.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { copiarParaTelaDeLogin, salvarIdentidade } from "@/app/admin/configuracoes/personalizacao/actions";
import { LIMITE_NOME_APP, REGEX_COR_HEX, type CampoImagem } from "@/lib/personalizacao/campos";
import { PersonalizacaoUploadImagem } from "@/components/admin/personalizacao-upload-imagem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export type PersonalizacaoInicial = {
  nome: string;
  corPrimaria: string;
  corPwa: string;
  imagens: Record<CampoImagem, string | null>;
};

// Seletor de cor + campo hexadecimal. Valor vazio = "sem cor definida".
function CampoCor({
  id,
  rotulo,
  nota,
  valor,
  aoMudar,
  fallbackPicker,
  desabilitado,
}: {
  id: string;
  rotulo: string;
  nota: string;
  valor: string;
  aoMudar: (valor: string) => void;
  fallbackPicker: string;
  desabilitado: boolean;
}) {
  const valido = valor === "" || REGEX_COR_HEX.test(valor);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Escolher ${rotulo.toLowerCase()}`}
          value={REGEX_COR_HEX.test(valor) ? valor : fallbackPicker}
          onChange={(e) => aoMudar(e.target.value)}
          disabled={desabilitado}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Input
          id={id}
          value={valor}
          maxLength={7}
          placeholder="#rrggbb"
          aria-invalid={!valido}
          onChange={(e) => aoMudar(e.target.value)}
          disabled={desabilitado}
          className="w-32 font-mono"
        />
        {valor !== "" && (
          <Button type="button" variant="ghost" size="sm" disabled={desabilitado} onClick={() => aoMudar("")}>
            Limpar
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{nota}</p>
    </div>
  );
}

export function PersonalizacaoForm({ inicial }: { inicial: PersonalizacaoInicial }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial.nome);
  const [corPrimaria, setCorPrimaria] = useState(inicial.corPrimaria);
  const [corPwa, setCorPwa] = useState(inicial.corPwa);
  // Últimos valores SALVOS (para saber se há alteração pendente e para o "Copiar para o login").
  const [salvos, setSalvos] = useState({ nome: inicial.nome, corPrimaria: inicial.corPrimaria, corPwa: inicial.corPwa });
  const [logoClaro, setLogoClaro] = useState(inicial.imagens.escola_logo_url);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, startSalvar] = useTransition();

  const [confirmandoCopia, setConfirmandoCopia] = useState(false);
  const [erroCopia, setErroCopia] = useState<string | null>(null);
  const [okCopia, setOkCopia] = useState<string | null>(null);
  const [copiando, startCopiar] = useTransition();

  const alterado = nome !== salvos.nome || corPrimaria !== salvos.corPrimaria || corPwa !== salvos.corPwa;
  const coresValidas =
    (corPrimaria === "" || REGEX_COR_HEX.test(corPrimaria)) && (corPwa === "" || REGEX_COR_HEX.test(corPwa));

  function salvar() {
    setErro(null);
    setOk(false);
    startSalvar(async () => {
      const r = await salvarIdentidade({ nome, corPrimaria, corPwa });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setSalvos({ nome: nome.trim(), corPrimaria, corPwa });
      setNome(nome.trim());
      setOk(true);
      router.refresh();
    });
  }

  function copiar() {
    setErroCopia(null);
    setOkCopia(null);
    startCopiar(async () => {
      const r = await copiarParaTelaDeLogin();
      if ("error" in r) {
        setErroCopia(r.error);
        setConfirmandoCopia(false);
        return;
      }
      setConfirmandoCopia(false);
      setOkCopia(`Copiado: ${r.copiados.join(" e ")}.`);
      router.refresh();
    });
  }

  const podeCopiar = !!logoClaro || !!salvos.corPrimaria;

  const aoAlterarImagem = (campo: CampoImagem, url: string | null) => {
    if (campo === "escola_logo_url") setLogoClaro(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ===== Identidade ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
          <CardDescription>Nome e cores da aplicação.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pers-nome">Nome da aplicação</Label>
            <Input
              id="pers-nome"
              value={nome}
              maxLength={LIMITE_NOME_APP}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              className="max-w-md"
            />
            <p className="text-muted-foreground text-xs">
              É o nome da escola (o mesmo de Configurações &gt; Dados da escola): aparece em e-mails, PDFs e no nome do app instalado.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <CampoCor
              id="pers-cor-primaria"
              rotulo="Cor primária"
              nota="Alimenta a cor do PWA (se a cor do PWA estiver vazia) e o botão de copiar para a tela de login."
              valor={corPrimaria}
              aoMudar={setCorPrimaria}
              fallbackPicker="#0ea5e9"
              desabilitado={salvando}
            />
            <CampoCor
              id="pers-cor-pwa"
              rotulo="Cor do PWA"
              nota="Vazio = mesma da primária. Usada na barra do app instalado e na tela de abertura."
              valor={corPwa}
              aoMudar={setCorPwa}
              fallbackPicker={REGEX_COR_HEX.test(corPrimaria) ? corPrimaria : "#0f172a"}
              desabilitado={salvando}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={salvar} disabled={salvando || !alterado || !coresValidas || !nome.trim()}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
            {ok && !alterado && (
              <span role="status" className="text-sm text-green-600 dark:text-green-400">
                Salvo.
              </span>
            )}
            {!coresValidas && <span className="text-destructive text-sm">Cor inválida (use o formato #rrggbb).</span>}
            {erro && (
              <span role="alert" className="text-destructive text-sm">
                {erro}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== Logos e imagens ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Logos e Imagens</CardTitle>
          <CardDescription>
            Cada envio é salvo na hora. O painel admin e o portal do aluno são escuros: neles vale a logo do tema escuro.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 divide-y [&>*:not(:first-child)]:pt-6">
          {(
            [
              "escola_logo_url",
              "escola_logo_escuro_url",
              "escola_logo_colapsada_url",
              "escola_logo_colapsada_escuro_url",
              "escola_favicon_url",
              "portal_login_imagem_fundo_url",
            ] as const
          ).map((campo) => (
            <PersonalizacaoUploadImagem key={campo} campo={campo} urlInicial={inicial.imagens[campo]} onAlterou={aoAlterarImagem} />
          ))}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" disabled={!podeCopiar || copiando} onClick={() => setConfirmandoCopia(true)}>
                <Copy />
                Copiar para tela de login
              </Button>
              {okCopia && (
                <span role="status" className="text-sm text-green-600 dark:text-green-400">
                  {okCopia}
                </span>
              )}
              {erroCopia && (
                <span role="alert" className="text-destructive text-sm">
                  {erroCopia}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Usa a logo e a cor primária da escola como imagem e cor primária da tela de login do aluno.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ===== PWA ===== */}
      <Card>
        <CardHeader>
          <CardTitle>PWA</CardTitle>
          <CardDescription>Ícones do app instalado no celular. Se vazios, usam os ícones padrão da escola.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 divide-y [&>*:not(:first-child)]:pt-6">
          {(["pwa_icone_192_url", "pwa_icone_512_url"] as const).map((campo) => (
            <PersonalizacaoUploadImagem key={campo} campo={campo} urlInicial={inicial.imagens[campo]} />
          ))}
          <p className="text-muted-foreground text-xs">
            Quem já instalou o app pode levar algum tempo (ou precisar reinstalar) para ver o ícone novo.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmandoCopia} onOpenChange={(aberto) => !copiando && setConfirmandoCopia(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar para a tela de login</AlertDialogTitle>
            <AlertDialogDescription>
              Isto <strong>sobrescreve</strong> a imagem e a cor primária atuais da tela de login do aluno pela logo e pela cor
              primária da escola (salvas). A imagem de login anterior deixa de ser usada. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={copiando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={copiando} onClick={copiar}>
              {copiando ? "Copiando..." : "Sobrescrever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
