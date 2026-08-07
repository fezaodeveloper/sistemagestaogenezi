import { Skeleton } from "@/components/ui/skeleton";

export default function AulaConteudoLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-7 w-72" />
      </div>

      <Skeleton className="aspect-video w-full rounded-xl" />

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
    </div>
  );
}
