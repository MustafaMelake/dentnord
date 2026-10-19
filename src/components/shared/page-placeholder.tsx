// TODO: remove once every route has a real page.
export function PagePlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-24">
      <h1 className="text-display-lg">{title}</h1>
      <p className="text-muted-foreground">{note}</p>
    </main>
  );
}
