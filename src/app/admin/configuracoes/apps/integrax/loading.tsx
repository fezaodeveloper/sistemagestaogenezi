import { Skeleton } from "@/components/ui/skeleton";

export default function IntegraxLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-72 w-full max-w-2xl rounded-xl" />
      <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
    </div>
  );
}
