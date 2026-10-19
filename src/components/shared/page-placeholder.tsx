// TODO: remove once every route has a real page.
export function PagePlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="mx-auto flex w-full max-w-page flex-1 flex-col gap-4 px-4 pt-36 pb-24 sm:px-6 lg:px-10">
      <h1 className="text-display-lg text-ink">{title}</h1>
      <p className="text-ink-muted">{note}</p>
    </main>
  );
}
