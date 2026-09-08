import { requireRole } from "@/lib/auth/dal";
import { getBadgesComRecompensas, getOpcoesRecompensa } from "@/app/admin/engajamento/recompensas/actions";
import { RecompensasMedalhasView } from "@/components/admin/recompensas-medalhas-view";

export default async function RecompensasPage() {
  await requireRole("admin");

  const [badges, opcoes] = await Promise.all([getBadgesComRecompensas(), getOpcoesRecompensa()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Recompensas por Medalha</h1>
        <p className="text-muted-foreground text-sm">
          Vincule prêmios ou cursos bônus a medalhas — concedidos automaticamente quando o aluno
          conquista.
        </p>
      </div>
      <RecompensasMedalhasView badges={badges} premios={opcoes.premios} cursos={opcoes.cursos} />
    </div>
  );
}
