// Post-build guard: fails if the shipped CSS doesn't match the source.
//
// Why: a Vercel build once restored a stale Turbopack cache and shipped the PREVIOUS compile of
// globals.css next to the new next/font CSS. The site rendered in Times (CSS referenced font
// variables that fonts.ts no longer defined), with no brand colours and no new utilities. The build
// itself passed. These checks would have failed it.
//
// Checks:
//   1. fonts:    each variable declared in src/lib/fonts.ts is defined, and no font variable is
//                referenced that fonts.ts doesn't declare.
//   2. theme:    every theme variable the CSS uses (var(--color-*|--font-*|--radius-*|--text-*|
//                --container-*)) is defined in that CSS.
//   3. classes:  every class in a page's HTML has a matching selector in that page's CSS (stale
//                Tailwind output misses the utilities of new components).
//
// Local build (default): 1+2 run over ALL emitted CSS, so an empty or broken build always fails.
// 1–3 then run per prerendered page. Pages are found by content, not path: with a deployment
// adapter (Vercel) Next writes them to .next/server/route-cache/<kind>/<hash>/$/<route>.html instead
// of .next/server/app/<route>.html. /en and /da (fully static) are required; other pages, like the
// /admin PPR shell, are checked when present. If the required pages can't be found on Vercel,
// that is a warning (the CSS checks still apply); the post-deploy --url check is the final word.
//
// Usage:
//   node scripts/check-build-css.mjs                 # after `next build` (part of pnpm build)
//   node scripts/check-build-css.mjs --url <url>...  # live pages, e.g. after a deploy

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, ".next");
const REQUIRED_ROUTES = ["/en", "/da"];

// Class names that are hooks for JS/CSS selectors or libraries, not styles of their own.
const NON_STYLE_CLASSES = new Set(["group", "peer", "dark", "light", "lenis", "lenis-smooth"]);
const NON_STYLE_PATTERNS = [/^group\//, /^peer\//, /^lucide(-|$)/];

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

const errors = [];
const warnings = [];
let checked;

if (urls.length > 0) {
  const pages = await loadRemote(urls);
  for (const page of pages) errors.push(...checkPage(page).map((e) => `${page.name}: ${e}`));
  checked = pages.map((p) => p.name);
} else {
  if (!existsSync(DIST)) fail([".next not found: run `next build` first."]);

  const cssFiles = walk(join(DIST, "static")).filter((f) => f.endsWith(".css"));
  if (cssFiles.length === 0) fail(["no .css files in .next/static: nothing was compiled."]);
  const allCss = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  errors.push(...checkCss(allCss).map((e) => `emitted CSS: ${e}`));

  const pages = findPages(cssFiles);
  for (const page of pages) errors.push(...checkPage(page).map((e) => `${page.name}: ${e}`));

  const absent = REQUIRED_ROUTES.filter((r) => !pages.some((p) => p.name === r));
  if (absent.length > 0) {
    const msg = `prerendered pages not found for ${absent.join(", ")}: per-page class check skipped`;
    (process.env.VERCEL ? warnings : errors).push(msg);
  }
  const names = pages.map((p) => p.name);
  checked = [
    `${cssFiles.length} CSS files`,
    `${pages.length} pages`,
    ...[...REQUIRED_ROUTES, "/admin"].filter((r) => names.includes(r)),
  ];
}

for (const w of warnings) console.warn(`check-build-css: WARNING ${w}`);
if (errors.length > 0) fail(errors);
console.log(`check-build-css: OK (fonts ${fontVars.join(", ")}; ${checked.join(", ")})`);

// ---------------------------------------------------------------------------------------------

function checkPage({ html, css }) {
  if (!css) return ["links no stylesheet"];
  return [...checkCss(css), ...checkClasses(html, css)];
}

function checkCss(css) {
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
  return out;
}

// 3. classes
function checkClasses(html, css) {
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
  if (missing.length === 0) return [];
  return [
    `${missing.length} classes have no CSS rule (stale or unprocessed Tailwind output?): ${missing.slice(0, 12).join(" ")}${missing.length > 12 ? " …" : ""}`,
  ];
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

// Prerendered documents rendered by our root layouts (they put the font classes on <html>), anywhere
// under .next/server. Skips empty param templates and Next's own error documents.
function findPages(cssFiles) {
  const byName = new Map(cssFiles.map((f) => [basename(f), f]));
  return walk(join(DIST, "server"))
    .filter((f) => f.endsWith(".html"))
    .map((file) => ({ file, html: readFileSync(file, "utf8") }))
    .filter(({ html }) => /<html[^>]*\sclass="/.test(html))
    .map(({ file, html }) => {
      const css = stylesheetHrefs(html)
        .map((href) => {
          const path = decodeURIComponent(new URL(href, "http://x").pathname);
          const cssPath = [
            join(DIST, path.replace(/^\/_next\//, "")),
            byName.get(basename(path)),
          ].find((f) => f && existsSync(f));
          if (!cssPath)
            errors.push(`${routeOf(file)}: links ${href}, which is not in the build output`);
          return cssPath ? readFileSync(cssPath, "utf8") : "";
        })
        .join("\n");
      return { name: routeOf(file), html, css };
    });
}

// .next/server/app/en/about.html                              → /en/about
// .next/server/route-cache/APP_PAGE/<hash>/$/en/about.html    → /en/about   (adapter builds)
function routeOf(file) {
  const rel = relative(join(DIST, "server"), file).replaceAll("\\", "/");
  const route =
    /^route-cache\/[^/]+\/[^/]+\/\$(\/.+)\.html$/.exec(rel)?.[1] ??
    /^app(\/.+)\.html$/.exec(rel)?.[1] ??
    `/${rel}`;
  return route === "/index" ? "/" : route;
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
  if (!existsSync(dir)) return [];
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
