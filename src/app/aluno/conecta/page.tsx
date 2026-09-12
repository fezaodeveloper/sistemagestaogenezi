import { requireRole } from "@/lib/auth/dal";
import { buscarVagasConecta, getCursosConcluidosAluno, getMeuPerfilConecta } from "@/app/aluno/conecta/actions";
import { AlunoConectaView } from "@/components/aluno/aluno-conecta-view";

export default async function AlunoConectaPage() {
  const user = await requireRole("aluno");

  const [perfil, cursosConcluidos, vagasResultado] = await Promise.all([
    getMeuPerfilConecta(),
    getCursosConcluidosAluno(user.id),
    buscarVagasConecta(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">
          Vagas de emprego e estágio das empresas parceiras da GÊNEZI.
        </p>
      </div>
      <AlunoConectaView
        perfilInicial={perfil}
        cursosConcluidos={cursosConcluidos}
        vagasResultadoInicial={vagasResultado}
      />
    </div>
  );
}
