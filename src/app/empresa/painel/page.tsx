import Link from "next/link";
import { Bell, Briefcase, Plus } from "lucide-react";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  getContagemNotificacoesNaoLidas,
  getContagemVagasAtivas,
  getEmpresaPorProfileId,
} from "@/lib/conecta/empresas";
import { EMPRESA_STATUS_LABELS } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EmpresaPainelPage() {
  const user = await requireEmpresa();
  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);

  if (!empresa) {
    return (
      <Card>
        <CardContent className="text-destructive py-10 text-center text-sm">
          Não foi possível carregar os dados da sua empresa. Contate o suporte.
        </CardContent>
      </Card>
    );
  }

  if (empresa.status !== "ativa") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {empresa.nome_empresa}</h1>
          <Badge variant="outline" className="mt-1">
            {EMPRESA_STATUS_LABELS[empresa.status]}
          </Badge>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            {empresa.status === "pendente" ? (
              <p className="text-sm">
                Seu cadastro está em análise. Você receberá um e-mail quando for aprovado.
              </p>
            ) : (
              <p className="text-sm">
                Seu cadastro está {EMPRESA_STATUS_LABELS[empresa.status].toLowerCase()} no momento. Fale
                com a administração da GÊNEZI para mais informações.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [vagasAtivas, notificacoesNaoLidas] = await Promise.all([
    getContagemVagasAtivas(supabase, empresa.id),
    getContagemNotificacoesNaoLidas(supabase, empresa.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {empresa.nome_empresa}</h1>
          <p className="text-muted-foreground text-sm">Bem-vindo ao painel da sua empresa.</p>
        </div>
        <Button render={<Link href="/empresa/vagas" />} nativeButton={false}>
          <Plus />
          Publicar nova vaga
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Briefcase className="text-muted-foreground size-4" />
            <CardTitle className="text-sm font-medium">Vagas ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{vagasAtivas}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Bell className="text-muted-foreground size-4" />
            <CardTitle className="text-sm font-medium">Notificações não lidas</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{notificacoesNaoLidas}</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
