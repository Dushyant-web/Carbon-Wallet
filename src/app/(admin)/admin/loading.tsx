/** Shown instantly while the next page loads, so a click always answers at once. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 bg-canvas-subtle" />
      <div className="h-10 w-80 max-w-full bg-canvas-subtle" />
      <div className="h-44 w-full bg-canvas-subtle" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-56 bg-canvas-subtle" />
        <div className="h-56 bg-canvas-subtle" />
      </div>
    </div>
  );
}
