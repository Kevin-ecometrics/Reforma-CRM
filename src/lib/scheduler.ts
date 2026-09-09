import cron from "node-cron";
import { checkFacebookTokenValidity, syncFacebookLeads } from "./facebookSync";
import { runAutomationTick } from "./automation";

declare global {
  // eslint-disable-next-line no-var
  var __crmSchedulerStarted: boolean | undefined;
}

export function startScheduler(): void {
  if (global.__crmSchedulerStarted) return;
  global.__crmSchedulerStarted = true;

  // Every 5 minutes: pull new Facebook leads, then evaluate time-based
  // automation rules (e.g. stale "Contacted" leads).
  cron.schedule("*/5 * * * *", async () => {
    await syncFacebookLeads();
    await runAutomationTick();
  });

  // Once a day: confirm the Page Access Token is still valid, so Settings
  // can flag a dead token (revoked permission, password change, app removed)
  // before it silently breaks the 5-minute sync above.
  cron.schedule("0 8 * * *", async () => {
    await checkFacebookTokenValidity();
  });

  // Run once at startup too, so Settings has a fresh answer immediately
  // instead of waiting for the first 8am tick.
  void checkFacebookTokenValidity();

  console.log("[scheduler] started: Facebook sync + automation tick every 5 minutes, token check daily");
}
