import { EmpresaCadastroForm } from "@/components/empresa/empresa-cadastro-form";

// Pública de propósito — cadastro de empresa não exige login prévio (REGRA
// da tarefa). Sem requireRole/requireEmpresa aqui.
export default function EmpresaCadastroPage() {
  return (
    <main className="dark bg-background text-foreground flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">GÊNEZI Conecta</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre sua empresa e publique vagas para os alunos da GÊNEZI.
          </p>
        </div>
        <EmpresaCadastroForm />
      </div>
    </main>
  );
}
