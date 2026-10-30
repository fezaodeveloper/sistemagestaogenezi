// TAREFA agendamentos 2.4/campanha 2.5 (PARTE 4) — Suspense automático do Next enquanto o Server
// Component busca a página/config no banco. Reproduz só a moldura estática de AgendarTema
// (bg-background/p-6/min-h-svh) — o toggle de tema em si é client-only, sem sentido no skeleton.
export default function Loading() {
  return (
    <main className="bg-background text-foreground flex min-h-svh flex-col items-center p-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 py-6">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-muted h-12 w-32 animate-pulse rounded-md" />
          <div className="bg-muted h-7 w-64 animate-pulse rounded-md" />
          <div className="bg-muted h-4 w-48 animate-pulse rounded-md" />
        </div>
        <div className="flex w-full flex-col gap-3 rounded-lg border p-4">
          <div className="bg-muted h-40 w-full animate-pulse rounded-md" />
          <div className="bg-muted h-9 w-full animate-pulse rounded-md" />
        </div>
      </div>
    </main>
  );
}
