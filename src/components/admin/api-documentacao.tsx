"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BASE_URL = "https://sistemagestaogenezi.vercel.app";

type EndpointDoc = {
  id: string;
  label: string;
  recurso: string;
  parametros: { nome: string; descricao: string }[];
  exemploResposta: string;
};

const ENDPOINTS: EndpointDoc[] = [
  {
    id: "alunos",
    label: "Alunos",
    recurso: "alunos",
    parametros: [
      { nome: "status", descricao: "Filtra por status_aluno (ativo, inativo, trancado, formado)." },
      { nome: "limit", descricao: "Itens por página. Padrão 50, máximo 200." },
      { nome: "offset", descricao: "Deslocamento para paginação. Padrão 0." },
    ],
    exemploResposta: JSON.stringify(
      {
        data: [
          {
            id: "uuid",
            full_name: "Maria Silva",
            email: "maria@exemplo.com",
            cpf: "00000000000",
            telefone: "11999990000",
            status_aluno: "ativo",
            turmas_ativas: ["Turma A"],
            created_at: "2026-01-10T12:00:00.000Z",
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      },
      null,
      2,
    ),
  },
  {
    id: "matriculas",
    label: "Matrículas",
    recurso: "matriculas",
    parametros: [
      { nome: "status", descricao: "Filtra por status (ativa, inativa, concluida, cancelada, transferida)." },
      { nome: "aluno_id", descricao: "Filtra pelas matrículas de um aluno específico." },
      { nome: "limit", descricao: "Itens por página. Padrão 50, máximo 200." },
      { nome: "offset", descricao: "Deslocamento para paginação. Padrão 0." },
    ],
    exemploResposta: JSON.stringify(
      {
        data: [
          {
            id: "uuid",
            aluno_nome: "Maria Silva",
            aluno_email: "maria@exemplo.com",
            curso_nome: "Informática Básica",
            turma_nome: "Turma A",
            status: "ativa",
            valor_final: 1200,
            num_parcelas: 12,
            data_inicio: "2026-02-01",
            previsao_conclusao: "2026-12-01",
            created_at: "2026-01-10T12:00:00.000Z",
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      },
      null,
      2,
    ),
  },
  {
    id: "financeiro",
    label: "Financeiro",
    recurso: "financeiro",
    parametros: [
      { nome: "status", descricao: "Filtra as parcelas listadas (pendente, pago, atrasado)." },
      { nome: "aluno_id", descricao: "Filtra pelas parcelas de um aluno específico." },
      { nome: "mes", descricao: "Mês de vencimento (1-12), usado junto com ano." },
      { nome: "ano", descricao: "Ano de vencimento." },
      { nome: "limit", descricao: "Itens por página. Padrão 50, máximo 200." },
      { nome: "offset", descricao: "Deslocamento para paginação. Padrão 0." },
    ],
    exemploResposta: JSON.stringify(
      {
        resumo: { total_receber: 5000, total_recebido: 12000, total_atrasado: 800 },
        parcelas: [
          {
            id: "uuid",
            aluno_nome: "Maria Silva",
            curso_nome: "Informática Básica",
            numero_parcela: 3,
            valor: 100,
            data_vencimento: "2026-04-10",
            status: "pago",
            data_pagamento: "2026-04-09",
          },
        ],
      },
      null,
      2,
    ),
  },
  {
    id: "leads",
    label: "Leads",
    recurso: "leads",
    parametros: [
      { nome: "status", descricao: "Filtra por status (novo, contatado, aluno_ativo, ex_aluno, desistente, descartado)." },
      { nome: "limit", descricao: "Itens por página. Padrão 50, máximo 200." },
      { nome: "offset", descricao: "Deslocamento para paginação. Padrão 0." },
    ],
    exemploResposta: JSON.stringify(
      {
        data: [
          {
            id: "uuid",
            nome: "João Souza",
            email: null,
            telefone: "11988887777",
            curso_interesse: "Informática Básica",
            status: "novo",
            created_at: "2026-05-01T10:00:00.000Z",
            updated_at: "2026-05-01T10:00:00.000Z",
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      },
      null,
      2,
    ),
  },
  {
    id: "presencas",
    label: "Presenças",
    recurso: "presencas",
    parametros: [
      { nome: "turma_id", descricao: "Filtra pelas presenças de uma turma." },
      { nome: "aluno_id", descricao: "Filtra pelas presenças de um aluno." },
      { nome: "data_inicio", descricao: "Data mínima (AAAA-MM-DD)." },
      { nome: "data_fim", descricao: "Data máxima (AAAA-MM-DD)." },
      { nome: "limit", descricao: "Itens por página. Padrão 50, máximo 200." },
      { nome: "offset", descricao: "Deslocamento para paginação. Padrão 0." },
    ],
    exemploResposta: JSON.stringify(
      {
        data: [
          {
            id: "uuid",
            aluno_nome: "Maria Silva",
            turma_nome: "Turma A",
            aula_titulo: "Aula 1 — Introdução",
            data: "2026-05-05",
            status: "presente",
            justificativa: null,
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      },
      null,
      2,
    ),
  },
  {
    id: "eventos",
    label: "Eventos",
    recurso: "eventos",
    parametros: [
      { nome: "data_inicio", descricao: "Data mínima de início (AAAA-MM-DD)." },
      { nome: "data_fim", descricao: "Data máxima de término (AAAA-MM-DD)." },
      { nome: "tipo", descricao: "Filtra por tipo (aula, prova, evento, feriado, outro)." },
    ],
    exemploResposta: JSON.stringify(
      {
        data: [
          {
            id: "uuid",
            nome: "Prova final — Módulo 1",
            tipo: "prova",
            data_inicio: "2026-06-10",
            data_fim: "2026-06-10",
            abrangencia: "turma",
            gera_notificacao: true,
          },
        ],
        total: 1,
      },
      null,
      2,
    ),
  },
];

function EndpointTab({ endpoint, apiKeyAtiva }: { endpoint: EndpointDoc; apiKeyAtiva: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);

  function handleTestar() {
    if (!apiKeyAtiva) return;
    setResultado(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/${endpoint.recurso}`, {
          headers: { "X-API-Key": apiKeyAtiva },
        });
        const json: unknown = await response.json();
        setResultado(JSON.stringify(json, null, 2));
      } catch {
        setResultado(JSON.stringify({ error: "Não foi possível completar a requisição." }, null, 2));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">URL</span>
        <code className="bg-muted w-fit rounded-md px-3 py-1.5 text-xs">
          {BASE_URL}/api/v1/{endpoint.recurso}
        </code>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Método</span>
        <code className="bg-muted w-fit rounded-md px-3 py-1.5 text-xs">GET</code>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Header obrigatório
        </span>
        <code className="bg-muted w-fit rounded-md px-3 py-1.5 text-xs">X-API-Key: sua-chave-aqui</code>
      </div>

      {endpoint.parametros.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Parâmetros
          </span>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoint.parametros.map((param) => (
                <TableRow key={param.nome}>
                  <TableCell className="font-mono text-xs">{param.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{param.descricao}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Exemplo de resposta
        </span>
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
          <code>{endpoint.exemploResposta}</code>
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={!apiKeyAtiva || isPending}
          onClick={handleTestar}
        >
          {isPending ? "Testando..." : "Testar"}
        </Button>
        {!apiKeyAtiva && (
          <p className="text-muted-foreground text-xs">
            Gere uma API Key ativa na aba &quot;Chaves de API&quot; para testar os endpoints por aqui.
          </p>
        )}
        {resultado && (
          <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
            <code>{resultado}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

export function ApiDocumentacao({ apiKeyAtiva }: { apiKeyAtiva: string | null }) {
  return (
    <Card>
      <CardContent className="py-4">
        <Tabs defaultValue="alunos">
          <TabsList className="flex-wrap">
            {ENDPOINTS.map((endpoint) => (
              <TabsTrigger key={endpoint.id} value={endpoint.id}>
                {endpoint.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {ENDPOINTS.map((endpoint) => (
            <TabsContent key={endpoint.id} value={endpoint.id}>
              <EndpointTab endpoint={endpoint} apiKeyAtiva={apiKeyAtiva} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
