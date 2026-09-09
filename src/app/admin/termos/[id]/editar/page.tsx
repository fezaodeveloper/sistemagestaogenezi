import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getTermo } from "@/app/admin/termos/actions";
import { TermoEditorForm } from "@/components/admin/termo-editor-form";

export default async function EditarTermoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const termo = await getTermo(id);
  if (!termo) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar termo</h1>
      </div>
      <TermoEditorForm termo={termo} />
    </div>
  );
}
