"use client";

import { useRef, useState, useTransition } from "react";
import { Building2, MessageCircle, Search } from "lucide-react";
import { buscarVagasConecta } from "@/app/aluno/conecta/actions";
import {
  VAGA_MODALIDADE_LABELS,
  VAGA_MODALIDADES,
  VAGA_TIPO_LABELS,
  VAGA_TIPOS,
  type VagaConectaComEmpresa,
  type VagaModalidade,
  type VagaTipo,
  type VagasConectaResultado,
} from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LIMITE = 12;

const TIPO_FILTRO_TODOS = "todos";
const MODALIDADE_FILTRO_TODAS = "todas";

const TIPO_FILTRO_ITEMS: Record<string, string> = {
  [TIPO_FILTRO_TODOS]: "Todos",
  ...Object.fromEntries(VAGA_TIPOS.map((tipo) => [tipo, VAGA_TIPO_LABELS[tipo]])),
};
const MODALIDADE_FILTRO_ITEMS: Record<string, string> = {
  [MODALIDADE_FILTRO_TODAS]: "Todas",
  ...Object.fromEntries(VAGA_MODALIDADES.map((modalidade) => [modalidade, VAGA_MODALIDADE_LABELS[modalidade]])),
};

function formatSalario(vaga: VagaConectaComEmpresa): string {
  if (vaga.salario_oculto) return "A combinar";
  if (!vaga.salario_min && !vaga.salario_max) return "A combinar";
  const formatar = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (vaga.salario_min && vaga.salario_max) {
    return `${formatar(vaga.salario_min)} - ${formatar(vaga.salario_max)}`;
  }
  return formatar(vaga.salario_min ?? vaga.salario_max ?? 0);
}

function formatPrazo(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

function VagaCard({ vaga }: { vaga: VagaConectaComEmpresa }) {
  const whatsappDigitos = vaga.empresaWhatsapp?.replace(/\D/g, "");
  const mensagem = encodeURIComponent(
    `Olá! Vi a vaga de ${vaga.titulo} no Gênezi Conecta e tenho interesse.`,
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2">
          {vaga.empresaLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
            <img
              src={vaga.empresaLogoUrl}
              alt={vaga.empresaNome}
              className="size-8 shrink-0 rounded-md object-contain"
            />
          ) : (
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
              <Building2 className="text-muted-foreground size-4" />
            </div>
          )}
          <span className="text-muted-foreground truncate text-xs">{vaga.empresaNome}</span>
        </div>

        <h3 className="font-semibold">{vaga.titulo}</h3>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{VAGA_TIPO_LABELS[vaga.tipo]}</Badge>
          <Badge variant="outline">{VAGA_MODALIDADE_LABELS[vaga.modalidade]}</Badge>
        </div>

        <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <span>
            {vaga.cidade}/{vaga.estado}
          </span>
          <span>{formatSalario(vaga)}</span>
          {vaga.prazo_candidatura && <span>Candidaturas até {formatPrazo(vaga.prazo_candidatura)}</span>}
        </div>

        {whatsappDigitos ? (
          <Button
            className="bg-green-600 hover:bg-green-700"
            nativeButton={false}
            render={
              <a
                href={`https://wa.me/55${whatsappDigitos}?text=${mensagem}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <MessageCircle className="size-4" />
            Candidatar via WhatsApp
          </Button>
        ) : (
          <Button disabled title="Empresa não informou WhatsApp para contato.">
            <MessageCircle className="size-4" />
            Candidatar via WhatsApp
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ConectaVagasView({ resultadoInicial }: { resultadoInicial: VagasConectaResultado }) {
  const [resultado, setResultado] = useState(resultadoInicial);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState(TIPO_FILTRO_TODOS);
  const [modalidade, setModalidade] = useState(MODALIDADE_FILTRO_TODAS);
  const [cidade, setCidade] = useState("");
  const [pagina, setPagina] = useState(1);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function carregar(overrides: {
    query?: string;
    tipo?: string;
    modalidade?: string;
    cidade?: string;
    page?: number;
  }) {
    const novaBusca = overrides.query ?? busca;
    const novoTipo = overrides.tipo ?? tipo;
    const novaModalidade = overrides.modalidade ?? modalidade;
    const novaCidade = overrides.cidade ?? cidade;
    const novaPagina = overrides.page ?? pagina;

    startTransition(async () => {
      const atualizado = await buscarVagasConecta({
        query: novaBusca.trim() || undefined,
        tipo: novoTipo === TIPO_FILTRO_TODOS ? undefined : (novoTipo as VagaTipo),
        modalidade: novaModalidade === MODALIDADE_FILTRO_TODAS ? undefined : (novaModalidade as VagaModalidade),
        cidade: novaCidade.trim() || undefined,
        page: novaPagina,
        limit: LIMITE,
      });
      setResultado(atualizado);
      setBusca(novaBusca);
      setTipo(novoTipo);
      setModalidade(novaModalidade);
      setCidade(novaCidade);
      setPagina(novaPagina);
    });
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => carregar({ query: valor, page: 1 }), 300);
  }

  function handleCidadeChange(valor: string) {
    setCidade(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => carregar({ cidade: valor, page: 1 }), 300);
  }

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / LIMITE));

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => handleBuscaChange(e.target.value)}
            placeholder="Buscar por cargo ou empresa..."
            className="pl-9"
          />
        </div>
        <Select
          items={TIPO_FILTRO_ITEMS}
          value={tipo}
          onValueChange={(valor) => carregar({ tipo: valor ?? TIPO_FILTRO_TODOS, page: 1 })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_FILTRO_ITEMS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={MODALIDADE_FILTRO_ITEMS}
          value={modalidade}
          onValueChange={(valor) => carregar({ modalidade: valor ?? MODALIDADE_FILTRO_TODAS, page: 1 })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MODALIDADE_FILTRO_ITEMS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={cidade}
          onChange={(e) => handleCidadeChange(e.target.value)}
          placeholder="Cidade"
        />
      </div>

      {resultado.vagas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma vaga disponível no momento.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {resultado.vagas.map((vaga) => (
            <VagaCard key={vaga.id} vaga={vaga} />
          ))}
        </div>
      )}

      <Paginacao
        paginaAtual={pagina}
        totalPaginas={totalPaginas}
        totalRegistros={resultado.total}
        limite={LIMITE}
        onNavigate={(novaPagina) => carregar({ page: novaPagina })}
      />
    </div>
  );
}
