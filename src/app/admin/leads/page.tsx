import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getLeads } from "@/lib/leads/leads";
import { TabelaLeads } from "@/components/admin/tabela-leads";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function LeadsPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const itens = await getLeads(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-muted-foreground text-sm">
            Pessoas interessadas que ainda não se matricularam. Status aluno_ativo/ex_aluno/desistente são
            sincronizados automaticamente com o sistema.
          </p>
        </div>
        <Button render={<Link href="/admin/leads/novo" />} nativeButton={false}>
          <Plus />
          Novo lead
        </Button>
      </div>

      {itens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum lead cadastrado ainda.</p>
            <Button render={<Link href="/admin/leads/novo" />} nativeButton={false} variant="outline">
              <Plus />
              Cadastrar o primeiro lead
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TabelaLeads itens={itens} />
      )}
    </div>
  );
}
