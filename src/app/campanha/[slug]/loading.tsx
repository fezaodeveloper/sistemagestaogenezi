// TAREFA campanha 2.5 (PARTE 4) — Suspense automático do Next enquanto o Server Component busca
// a página/config no banco. Mesmo formato (max-w-lg, py-6) da página real, pra não dar salto de
// layout quando o conteúdo de verdade aparece.
export default function Loading() {
  return (
    <main className="flex min-h-svh flex-col items-center bg-slate-950 p-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 py-6">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-muted h-12 w-32 animate-pulse rounded-md" />
          <div className="bg-muted h-7 w-64 animate-pulse rounded-md" />
          <div className="bg-muted h-4 w-48 animate-pulse rounded-md" />
        </div>
        <div className="flex w-full flex-col gap-3 rounded-lg border p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-9 w-full animate-pulse rounded-md" />
          ))}
          <div className="bg-muted mt-2 h-10 w-full animate-pulse rounded-md" />
        </div>
      </div>
    </main>
  );
}
