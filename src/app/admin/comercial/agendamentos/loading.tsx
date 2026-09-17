export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-7 w-56 animate-pulse rounded-md" />
        <div className="bg-muted h-4 w-96 animate-pulse rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted h-48 w-full animate-pulse rounded-md" />
        ))}
      </div>
    </div>
  );
}
