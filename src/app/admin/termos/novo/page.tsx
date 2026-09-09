import { requireRole } from "@/lib/auth/dal";
import { TermoEditorForm } from "@/components/admin/termo-editor-form";

export default async function NovoTermoPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo termo</h1>
      </div>
      <TermoEditorForm />
    </div>
  );
}
