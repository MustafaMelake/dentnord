import { ScrollWords } from "@/components/motion/scroll-words";
import { Container } from "@/components/shared/container";
import { Missing } from "@/components/shared/missing";

export function Statement({ text }: { text: string }) {
  return (
    <section className="py-16 sm:py-28">
      <Container>
        {text ? (
          <ScrollWords text={text} className="max-w-[40ch] text-display-md" />
        ) : (
          <Missing field="homePage.statement" />
        )}
        <div aria-hidden className="mt-20 h-px bg-line sm:mt-28" />
      </Container>
    </section>
  );
}
