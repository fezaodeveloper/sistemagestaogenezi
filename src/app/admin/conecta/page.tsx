import { requireRole } from "@/lib/auth/dal";
import { getAtividadeRecenteConecta, getEmpresasConecta, getKpisConecta } from "@/app/admin/conecta/actions";
import { ConectaAtividadeRecente } from "@/components/admin/conecta-atividade-recente";
import { ConectaKpis } from "@/components/admin/conecta-kpis";
import { ConectaView } from "@/components/admin/conecta-view";

export default async function AdminConectaPage() {
  await requireRole("admin");

  // Em paralelo (REGRA da tarefa) — três buscas independentes.
  const [kpis, atividade, resultado] = await Promise.all([
    getKpisConecta(),
    getAtividadeRecenteConecta(),
    getEmpresasConecta(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Empresas — Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">
          Empresas parceiras cadastradas no portal de vagas.
        </p>
      </div>

      <ConectaKpis kpis={kpis} />

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">Atividade recente</h2>
        <ConectaAtividadeRecente atividade={atividade} />
      </div>

      <ConectaView resultadoInicial={resultado} />
    </div>
  );
}
