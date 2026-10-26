import { z } from "zod";

// Runs in the browser before any app code (Next.js instrumentation-client convention).
// zod 4 speeds up object parsing with `new Function`, after probing whether eval is allowed. Our CSP
// has no 'unsafe-eval', so the probe fails (zod falls back) but is still reported as a CSP
// violation on every page with a form. Jitless mode skips the probe; forms are small, the speed
// difference doesn't matter. (Server code keeps the default: no CSP there.)
z.config({ jitless: true });
