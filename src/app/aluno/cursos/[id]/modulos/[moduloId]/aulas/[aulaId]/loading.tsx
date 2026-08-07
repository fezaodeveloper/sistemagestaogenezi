import { Skeleton } from "@/components/ui/skeleton";

export default function AulaConteudoLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-7 w-72" />
      </div>

      <Skeleton className="aspect-video w-full rounded-xl" />
    </div>
  );
}
