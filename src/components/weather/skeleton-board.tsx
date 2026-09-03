export function SkeletonBoard() {
  return (
    <section className="rounded-xl bg-card p-5 md:p-6" aria-hidden="true">
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-10 rounded-sm bg-background" />
          <div className="h-7 w-40 rounded-sm bg-background" />
          <div className="h-4 w-28 rounded-sm bg-background" />
        </div>
        <div className="h-14 w-24 rounded-sm bg-background" />
      </div>
      <div className="mt-6 h-16 rounded-md bg-background" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="h-16 rounded-md bg-background" />
        <div className="h-16 rounded-md bg-background" />
        <div className="h-16 rounded-md bg-background" />
        <div className="h-16 rounded-md bg-background" />
      </div>
    </section>
  );
}
