import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";
import { getPublishedTestimonials } from "@/server/queries/content";

import { TestimonialsCarousel } from "./testimonials-carousel";

/** Hidden entirely until at least one consented testimonial is published (admins see a marker). */
export async function Testimonials({ locale }: { locale: string }) {
  const rows = await getPublishedTestimonials();
  if (rows.length === 0) {
    return (
      <Container>
        <Missing field="testimonials" />
      </Container>
    );
  }
  const items = rows.map((r) => ({
    id: r.id,
    quote: (locale === "en" ? r.quote.en : r.quote.da) || r.quote.da || r.quote.en,
    author: [r.authorName, r.clinic].filter(Boolean).join(", "),
    initials: r.authorName
      .split(/\s+/)
      .filter((w) => /^\p{L}/u.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join(""),
  }));
  return <TestimonialsCarousel items={items} />;
}
