"use client";

import { ConectaPerfilForm } from "@/components/aluno/conecta-perfil-form";
import { ConectaVagasView } from "@/components/aluno/conecta-vagas-view";
import type { PerfilConecta, VagasConectaResultado } from "@/lib/conecta/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AlunoConectaView({
  perfilInicial,
  cursosConcluidos,
  vagasResultadoInicial,
}: {
  perfilInicial: PerfilConecta | null;
  cursosConcluidos: string[];
  vagasResultadoInicial: VagasConectaResultado;
}) {
  return (
    <Tabs defaultValue="vagas">
      <TabsList>
        <TabsTrigger value="vagas">Vagas disponíveis</TabsTrigger>
        <TabsTrigger value="perfil">Meu perfil profissional</TabsTrigger>
      </TabsList>
      <TabsContent value="vagas">
        <ConectaVagasView resultadoInicial={vagasResultadoInicial} />
      </TabsContent>
      <TabsContent value="perfil">
        <ConectaPerfilForm perfilInicial={perfilInicial} cursosConcluidos={cursosConcluidos} />
      </TabsContent>
    </Tabs>
  );
}
