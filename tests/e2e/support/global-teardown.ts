import { cleanupE2EUsers } from "./db";

export default function globalTeardown() {
  console.log(`[e2e] removed ${cleanupE2EUsers()} test user(s)`);
}
