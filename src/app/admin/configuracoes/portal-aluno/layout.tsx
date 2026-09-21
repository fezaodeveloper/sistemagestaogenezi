import { requireRole } from "@/lib/auth/dal";
import { PortalAlunoNav } from "@/components/admin/portal-aluno-nav";

// Moldura do portal do aluno no admin: navegação lateral por seções + o conteúdo da seção.
export default async function PortalAlunoLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Portal do Aluno</h1>
        <p className="text-muted-foreground text-sm">Personalize a experiência dos alunos na plataforma.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[13rem_1fr]">
        <aside>
          <PortalAlunoNav />
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
