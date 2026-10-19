import { getTranslations } from "next-intl/server";

import { ScrollWords } from "@/components/motion/scroll-words";
import { Container } from "@/components/shared/container";

export async function Statement() {
  const t = await getTranslations("home");
  return (
    <section className="py-16 sm:py-28">
      <Container>
        <ScrollWords text={t("statement")} className="max-w-[40ch] text-display-md" />
        <div aria-hidden className="mt-20 h-px bg-line sm:mt-28" />
      </Container>
    </section>
  );
}
