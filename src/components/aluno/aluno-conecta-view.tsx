"use client";

import { ConectaPerfilForm } from "@/components/aluno/conecta-perfil-form";
import { ConectaVagasView } from "@/components/aluno/conecta-vagas-view";
import type { CidadeConecta, PerfilConecta, VagasConectaResultado } from "@/lib/conecta/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AlunoConectaView({
  perfilInicial,
  cursosConcluidos,
  vagasResultadoInicial,
  cidadesAprovadas,
  idade,
  textoTermoMenor,
  candidaturasVagaIdsIniciais,
}: {
  perfilInicial: PerfilConecta | null;
  cursosConcluidos: string[];
  vagasResultadoInicial: VagasConectaResultado;
  cidadesAprovadas: CidadeConecta[];
  idade: number | null;
  textoTermoMenor: string;
  candidaturasVagaIdsIniciais: string[];
}) {
  return (
    <Tabs defaultValue="vagas">
      <TabsList>
        <TabsTrigger value="vagas">Vagas disponíveis</TabsTrigger>
        <TabsTrigger value="perfil">Meu perfil profissional</TabsTrigger>
      </TabsList>
      <TabsContent value="vagas">
        <ConectaVagasView
          resultadoInicial={vagasResultadoInicial}
          cidadesAprovadas={cidadesAprovadas}
          candidaturasVagaIdsIniciais={candidaturasVagaIdsIniciais}
        />
      </TabsContent>
      <TabsContent value="perfil">
        <ConectaPerfilForm
          perfilInicial={perfilInicial}
          cursosConcluidos={cursosConcluidos}
          idade={idade}
          textoTermoMenor={textoTermoMenor}
        />
      </TabsContent>
    </Tabs>
  );
}
