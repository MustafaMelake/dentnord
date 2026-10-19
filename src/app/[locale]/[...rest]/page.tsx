import { notFound } from "next/navigation";

// Routes unknown paths under /[locale] to the localized not-found.tsx.
export default function CatchAllPage() {
  notFound();
}
