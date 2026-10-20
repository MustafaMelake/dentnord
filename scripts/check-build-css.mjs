// Post-build guard: fails if the shipped CSS doesn't match the source.
//
// Why: a Vercel build once restored a stale Turbopack cache and shipped the PREVIOUS compile of
// globals.css next to the new next/font CSS. The site rendered in Times (CSS referenced font
// variables that fonts.ts no longer defined), with no brand colours and no new utilities. The build
// itself passed. These checks would have failed it.
//
// For every prerendered page (both root layouts: [locale] and admin), using only that page's CSS:
//   1. fonts:    each variable declared in src/lib/fonts.ts is defined, and no font variable is
//                referenced that fonts.ts doesn't declare.
//   2. theme:    every theme variable the CSS uses (var(--color-*|--font-*|--radius-*|--text-*|
//                --container-*)) is defined in that CSS.
//   3. classes:  every class in the HTML has a matching selector (stale Tailwind output misses
//                the utilities of new components).
//
// Usage:
//   node scripts/check-build-css.mjs                 # checks .next after `next build` (part of pnpm build)
//   node scripts/check-build-css.mjs --url <url>...  # checks live pages, e.g. after a deploy

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, ".next");

// Class names that are hooks for JS/CSS selectors or libraries, not styles of their own.
const NON_STYLE_CLASSES = new Set(["group", "peer", "dark", "light", "lenis", "lenis-smooth"]);
const NON_STYLE_PATTERNS = [/^group\//, /^peer\//, /^lucide(-|$)/];
// One prerendered page per root layout must be among the checked pages, so the check can't pass vacuously.
const REQUIRED_PAGES = ["server/app/en.html", "server/app/admin.html"];

const THEME_NAMESPACES = /var\((--(?:color|font|radius|text|container)-[\w-]+)\)/g;

const fontVars = [
  ...readFileSync(join(ROOT, "src/lib/fonts.ts"), "utf8").matchAll(
    /variable:\s*["'](--[\w-]+)["']/g,
  ),
].map((m) => m[1]);
if (fontVars.length === 0)
  fail(['src/lib/fonts.ts: no `variable: "--…"` found; update this check.']);
// Font variables share a prefix (e.g. --ff-); anything referenced under it must be declared.
const fontPrefix = fontVars[0].slice(0, fontVars[0].indexOf("-", 2) + 1);

const urls = process.argv.includes("--url")
  ? process.argv.slice(process.argv.indexOf("--url") + 1)
  : [];
const pages = urls.length > 0 ? await loadRemote(urls) : loadLocal();

const errors = [];
for (const page of pages) errors.push(...checkPage(page).map((e) => `${page.name}: ${e}`));
if (errors.length > 0) fail(errors);
console.log(`check-build-css: OK (${pages.length} pages, fonts ${fontVars.join(", ")})`);

// ---------------------------------------------------------------------------------------------

function checkPage({ html, css }) {
  const out = [];
  const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

  // 1. fonts
  for (const v of fontVars)
    if (!defined.has(v))
      out.push(`font variable ${v} (src/lib/fonts.ts) is not defined in the CSS`);
  const referencedFont = new Set(
    [...css.matchAll(new RegExp(`var\\((${escapeRe(fontPrefix)}[\\w-]+)`, "g"))].map((m) => m[1]),
  );
  for (const v of referencedFont) {
    if (!fontVars.includes(v))
      out.push(`CSS uses var(${v}), which src/lib/fonts.ts doesn't declare (stale CSS?)`);
  }

  // 2. theme variables
  const missingTheme = new Set();
  for (const [, v] of css.matchAll(THEME_NAMESPACES)) if (!defined.has(v)) missingTheme.add(v);
  if (missingTheme.size > 0)
    out.push(`theme variables used but never defined: ${[...missingTheme].join(", ")}`);

  // 3. classes
  const classes = new Set();
  for (const [, attr] of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const c of decodeEntities(attr).split(/\s+/)) if (c) classes.add(c);
  }
  const missing = [...classes].filter(
    (c) =>
      !NON_STYLE_CLASSES.has(c) &&
      !NON_STYLE_PATTERNS.some((p) => p.test(c)) &&
      !hasSelector(css, c),
  );
  if (missing.length > 0) {
    out.push(
      `${missing.length} classes have no CSS rule (stale or unprocessed Tailwind output?): ${missing.slice(0, 12).join(" ")}${missing.length > 12 ? " …" : ""}`,
    );
  }
  return out;
}

function hasSelector(css, className) {
  const sel = "." + cssEscape(className);
  for (let i = css.indexOf(sel); i !== -1; i = css.indexOf(sel, i + 1)) {
    // Must end the class token (not be a prefix of a longer class like .flex → .flex-col).
    if (!/[\w\\-]/.test(css[i + sel.length] ?? "")) return true;
  }
  return false;
}

// Minimal CSS.escape for class names, matching how Tailwind/Lightning CSS write selectors.
function cssEscape(s) {
  return s
    .replace(/[^\w-]/g, (ch) => `\\${ch}`)
    .replace(/^(-?)(\d)/, (_, dash, d) => `${dash}\\3${d} `);
}

function loadLocal() {
  if (!existsSync(DIST)) fail([".next not found: run `next build` first."]);
  // Only documents rendered by our root layouts (they put the font classes on <html>). Skips empty
  // param templates like [locale]/about.html and Next's own error documents (<html id="__next_error__">).
  const pages = walk(join(DIST, "server", "app"))
    .filter((f) => f.endsWith(".html"))
    .map((file) => ({ file, html: readFileSync(file, "utf8") }))
    .filter(({ html }) => /<html[^>]*\sclass="/.test(html));
  const names = pages.map(({ file }) => relative(DIST, file).replaceAll("\\", "/"));
  const absent = REQUIRED_PAGES.filter((p) => !names.includes(p));
  if (absent.length > 0)
    fail([`expected prerendered root-layout pages not found: ${absent.join(", ")}`]);
  return pages.map(({ file, html }) => {
    const css = stylesheetHrefs(html)
      .map((href) => {
        const path = join(DIST, decodeURIComponent(href.replace(/^\/_next\//, "").split("?")[0]));
        if (!existsSync(path))
          fail([`${relative(ROOT, file)} links ${href}, which is not in the build output`]);
        return readFileSync(path, "utf8");
      })
      .join("\n");
    return { name: relative(DIST, file).replaceAll("\\", "/"), html, css };
  });
}

async function loadRemote(list) {
  return Promise.all(
    list.map(async (url) => {
      const html = await (await fetch(url, { cache: "no-store" })).text();
      const sheets = await Promise.all(
        stylesheetHrefs(html).map(async (href) => (await fetch(new URL(href, url))).text()),
      );
      return { name: url, html, css: sheets.join("\n") };
    }),
  );
}

function stylesheetHrefs(html) {
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)]
    .map((m) => /href="([^"]+)"/.exec(m[0])?.[1])
    .filter((href) => href && decodeEntities(href).includes("/_next/static/"))
    .map(decodeEntities);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(lines) {
  console.error(`check-build-css: FAILED\n  ${lines.join("\n  ")}`);
  process.exit(1);
}
