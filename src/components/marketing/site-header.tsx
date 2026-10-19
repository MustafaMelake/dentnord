"use client";

import { useLenis } from "lenis/react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { MagneticButton } from "@/components/motion/magnetic";
import { spring, usePrefersReducedMotion } from "@/components/motion/use-media-query";
import { ButtonLink } from "@/components/shared/button";
import { Container } from "@/components/shared/container";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Logo } from "./logo";

// Fixed header. Transparent with white text over the home hero (CSS `over-hero:` variant),
// a blurred sticky bar once the page scrolls. Full-screen animated menu below `lg`.

const NAV = [
  { href: "/services", key: "services" },
  { href: "/portfolio", key: "portfolio" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export function SiteHeader() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <header
      data-site-header=""
      data-scrolled={scrolled || undefined}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={cn(
          "border-b transition-[background-color,border-color,padding] duration-500 ease-spring",
          scrolled
            ? "border-line/70 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-canvas/0",
          "over-hero:px-2 over-hero:pt-2 sm:over-hero:px-3 sm:over-hero:pt-3",
        )}
      >
        <Container
          className={cn(
            "flex items-center justify-between gap-6 transition-[height] duration-500 ease-spring",
            scrolled ? "h-16" : "h-[4.5rem] over-hero:h-20 lg:over-hero:h-24",
          )}
        >
          <Link
            href="/"
            aria-label={t("home")}
            className="rounded-full text-ink transition-colors duration-500 over-hero:text-white"
          >
            <Logo />
          </Link>

          <nav aria-label={t("main")} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="rounded-full px-4 py-2 text-[0.9375rem] text-ink transition-colors duration-300 hover:bg-ink/5 over-hero:text-white over-hero:hover:bg-white/10"
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher tone="header" className="hidden lg:inline-flex" />
            <Link
              href="/login"
              className="hidden rounded-full px-3 py-2 text-[0.9375rem] text-ink transition-colors duration-300 hover:bg-ink/5 lg:inline-block over-hero:text-white over-hero:hover:bg-white/10"
            >
              {t("login")}
            </Link>
            <MagneticButton className="hidden sm:block">
              <ButtonLink
                href="/portal/cases/new"
                variant="primary"
                className="over-hero:bg-surface over-hero:text-ink over-hero:hover:bg-brand-ice"
              >
                {t("submitCase")}
              </ButtonLink>
            </MagneticButton>
            <button
              ref={menuButtonRef}
              type="button"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={t("openMenu")}
              onClick={() => setOpen(true)}
              className="inline-flex h-11 items-center gap-3 rounded-full border border-line bg-surface/60 pr-1.5 pl-4 text-[0.9375rem] text-ink backdrop-blur-md transition-colors lg:hidden over-hero:border-white/30 over-hero:bg-white/10 over-hero:text-white"
            >
              {t("menu")}
              <span
                aria-hidden
                className="flex size-8 flex-col items-center justify-center gap-[3px] rounded-full bg-ink/5 over-hero:bg-white/15"
              >
                <span className="h-px w-3.5 bg-current" />
                <span className="h-px w-3.5 bg-current" />
              </span>
            </button>
          </div>
        </Container>
      </div>

      <MobileMenu open={open} onClose={() => setOpen(false)} triggerRef={menuButtonRef} />
    </header>
  );
}

function MobileMenu({
  open,
  onClose,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  /** Focus returns here on close (Safari doesn't focus buttons on click, so don't rely on activeElement). */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("nav");
  const reduce = usePrefersReducedMotion();
  const lenis = useLenis();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => onClose(), [onClose]);

  // Lock scroll, move focus in, trap Tab, close on Escape, restore focus on close.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    lenis?.stop();
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [],
      );
    requestAnimationFrame(() => focusables()[0]?.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = overflow;
      lenis?.start();
      trigger?.focus();
    };
  }, [open, close, lenis, triggerRef]);

  // Close on desktop resize.
  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia("(min-width: 64rem)");
    const onChange = () => mql.matches && close();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [open, close]);

  const transition = reduce ? { duration: 0 } : spring;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("menu")}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-brand-deep text-white"
          initial={{ clipPath: "inset(0 0 100% 0 round 0 0 32px 32px)" }}
          animate={{ clipPath: "inset(0 0 0% 0 round 0 0 0px 0px)" }}
          exit={{ clipPath: "inset(0 0 100% 0 round 0 0 32px 32px)" }}
          transition={transition}
        >
          <Container className="flex h-[4.5rem] items-center justify-between">
            <Link href="/" onClick={close} aria-label={t("home")} className="rounded-full">
              <Logo />
            </Link>
            <button
              type="button"
              onClick={close}
              aria-label={t("closeMenu")}
              className="inline-flex h-11 items-center gap-3 rounded-full border border-white/30 bg-white/10 pr-1.5 pl-4 text-[0.9375rem]"
            >
              {t("menu")}
              <span
                aria-hidden
                className="relative flex size-8 items-center justify-center rounded-full bg-white/15"
              >
                <span className="absolute h-px w-3.5 rotate-45 bg-current" />
                <span className="absolute h-px w-3.5 -rotate-45 bg-current" />
              </span>
            </button>
          </Container>

          <Container
            as="nav"
            aria-label={t("main")}
            className="flex flex-1 flex-col justify-center py-10"
          >
            <ul className="flex flex-col gap-1">
              {NAV.map((item, i) => (
                <li key={item.key} className="overflow-hidden">
                  <motion.div
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={reduce ? { duration: 0 } : { ...spring, delay: 0.12 + i * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      onClick={close}
                      className="group flex items-baseline gap-4 py-2 text-[clamp(2.25rem,9vw,3.5rem)] leading-none tracking-[-0.03em]"
                    >
                      <span className="font-mono text-xs tracking-normal text-white/60">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="transition-transform duration-300 ease-spring group-hover:translate-x-1">
                        {t(item.key)}
                      </span>
                    </Link>
                  </motion.div>
                </li>
              ))}
            </ul>
          </Container>

          <Container className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 py-6">
            <div className="flex items-center gap-3">
              <ButtonLink href="/portal/cases/new" variant="light" icon onClick={close}>
                {t("submitCase")}
              </ButtonLink>
              <Link
                href="/login"
                onClick={close}
                className="rounded-full px-3 py-2 text-white/90 hover:text-white"
              >
                {t("login")}
              </Link>
            </div>
            <LocaleSwitcher tone="onDark" />
          </Container>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
