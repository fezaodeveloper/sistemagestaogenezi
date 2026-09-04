import { requireRole } from "@/lib/auth/dal";
import { getTermos } from "@/app/admin/termos/actions";
import { TermosView } from "@/components/admin/termos-view";

export default async function TermosPage() {
  await requireRole("admin");

  const termos = await getTermos();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Termos</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie os termos de uso, termos de imagem e outros documentos.
        </p>
      </div>
      <TermosView termosIniciais={termos} />
    </div>
  );
}
