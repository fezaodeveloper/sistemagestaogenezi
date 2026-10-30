import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getConectaHabilitado } from "@/lib/configuracoes/conecta";
import {
  buscarVagasConecta,
  getCursosConcluidosAluno,
  getIdadeAlunoConecta,
  getMeuPerfilConecta,
  getMinhasCandidaturasAluno,
  getMinhasCandidaturasVagaIds,
} from "@/app/aluno/conecta/actions";
import { getCidadesAprovadas } from "@/lib/conecta/publico";
import { getTermoLegalPublico, textoPlanoDoTermo } from "@/lib/termos-legais/get-termo";
import { AlunoConectaView } from "@/components/aluno/aluno-conecta-view";

const TEXTO_TERMO_MENOR_PADRAO =
  "Declaro que serei acompanhado por um dos meus pais ou responsável legal em qualquer entrevista de emprego.";

export default async function AlunoConectaPage() {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const conectaHabilitado = await getConectaHabilitado(supabase);
  if (!conectaHabilitado) {
    notFound();
  }

  const [
    perfil,
    cursosConcluidos,
    vagasResultado,
    cidadesAprovadas,
    idade,
    termoMenor,
    candidaturasVagaIds,
    minhasCandidaturas,
  ] = await Promise.all([
    getMeuPerfilConecta(),
    getCursosConcluidosAluno(user.id),
    buscarVagasConecta(),
    getCidadesAprovadas(),
    getIdadeAlunoConecta(user.id),
    getTermoLegalPublico("conecta_menor_termo"),
    getMinhasCandidaturasVagaIds(),
    getMinhasCandidaturasAluno(),
  ]);

  const textoTermoMenor = termoMenor?.conteudo?.trim()
    ? textoPlanoDoTermo(termoMenor.conteudo)
    : TEXTO_TERMO_MENOR_PADRAO;

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
        cidadesAprovadas={cidadesAprovadas}
        idade={idade}
        textoTermoMenor={textoTermoMenor}
        candidaturasVagaIdsIniciais={candidaturasVagaIds}
        minhasCandidaturas={minhasCandidaturas}
      />
    </div>
  );
}
