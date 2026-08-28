import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ManutencaoLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-48" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
