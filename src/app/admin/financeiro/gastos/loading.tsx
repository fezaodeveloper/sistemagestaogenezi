import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function GastosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>

      <Card className="max-w-xs">
        <CardContent className="flex flex-col gap-2 py-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-24" />
        </CardContent>
      </Card>

      <Skeleton className="h-9 w-48" />

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
