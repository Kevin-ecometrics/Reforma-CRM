export async function register() {
  // Only run on the Node.js server runtime (not edge, not the browser),
  // and skip during `next build` where NEXT_RUNTIME is also "nodejs" but
  // there's no long-lived process to schedule against.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
