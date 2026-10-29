import { requireEmpresa } from "@/lib/auth/dal";
import { getCandidaturasEmpresa, getCandidatosDisponiveis } from "@/app/empresa/(protegido)/candidatos/actions";
import { CandidatosView } from "@/components/empresa/candidatos-view";
import { CandidaturasView } from "@/components/empresa/candidaturas-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function EmpresaCandidatosPage() {
  await requireEmpresa();

  const [candidatos, candidaturas] = await Promise.all([getCandidatosDisponiveis(), getCandidaturasEmpresa()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Candidatos</h1>
        <p className="text-muted-foreground text-sm">
          Candidatos que se candidataram às suas vagas, e outros perfis disponíveis na Gênezi Conecta.
        </p>
      </div>
      <Tabs defaultValue="candidaturas">
        <TabsList>
          <TabsTrigger value="candidaturas">Candidaturas recebidas</TabsTrigger>
          <TabsTrigger value="disponiveis">Todos os candidatos disponíveis</TabsTrigger>
        </TabsList>
        <TabsContent value="candidaturas">
          <CandidaturasView candidaturas={candidaturas} />
        </TabsContent>
        <TabsContent value="disponiveis">
          <CandidatosView candidatosIniciais={candidatos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
