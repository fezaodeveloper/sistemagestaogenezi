import { EmpresaCadastroForm } from "@/components/empresa/empresa-cadastro-form";
import { Card, CardContent } from "@/components/ui/card";

// Pública de propósito — cadastro de empresa não exige login prévio (REGRA
// da tarefa). Sem requireRole/requireEmpresa aqui.
export default async function EmpresaCadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ excluida?: string }>;
}) {
  const { excluida } = await searchParams;

  return (
    <main className="dark bg-background text-foreground flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">GÊNEZI Conecta</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre sua empresa e publique vagas para os alunos da GÊNEZI.
          </p>
        </div>
        {excluida === "true" && (
          <Card className="border-green-500/30">
            <CardContent className="py-4 text-center text-sm">
              Sua conta foi excluída com sucesso.
            </CardContent>
          </Card>
        )}
        <EmpresaCadastroForm />
      </div>
    </main>
  );
}
