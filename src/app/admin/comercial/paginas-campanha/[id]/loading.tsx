export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-muted h-10 w-full animate-pulse rounded-md" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-muted h-96 w-full animate-pulse rounded-md" />
        <div className="bg-muted h-96 w-full animate-pulse rounded-md" />
      </div>
    </div>
  );
}
