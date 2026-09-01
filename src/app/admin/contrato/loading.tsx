import { Skeleton } from "@/components/ui/skeleton";

export default function ContratoTemplateLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex flex-col gap-8 lg:flex-row">
        <Skeleton className="h-96 max-w-2xl flex-1" />
        <Skeleton className="h-96 flex-1" />
      </div>
    </div>
  );
}
