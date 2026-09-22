import { Skeleton } from "@/components/ui/skeleton";

export default function WhatsappFluxoEditorLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-72" />
      </div>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-[34rem] w-full rounded-xl" />
    </div>
  );
}
