/**
 * Browser click-through of every page and form, run against a live server.
 *
 *   E2E_PASSWORD="your-owner-password" npm run test:e2e
 *   (optional) E2E_BASE_URL=http://localhost:3000
 *
 * It POSTS REAL TRANSACTIONS (all labelled "E2E …"), so run it against a
 * development / demo database, never against your real books.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD to the owner password.");
  process.exit(2);
}
const TAG = `E2E ${Date.now().toString(36)}`;
const results = [];
const consoleErrors = [];

async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message.split("\n")[0] });
    console.log(`  ✗ ${name}\n      ${e.message.split("\n").slice(0, 3).join("\n      ")}`);
    if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/fail-${results.length}.png`, fullPage: true }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {}); // don't let an open dialog break later steps
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.setDefaultTimeout(15_000);
page.on("pageerror", (e) => consoleErrors.push(`${page.url()} → ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${page.url()} → ${m.text()}`); });

const api = async (path) => {
  const r = await page.request.get(BASE + path);
  assert.equal(r.status(), 200, `GET ${path} → ${r.status()}`);
  return r.json();
};
const dialog = () => page.getByRole("dialog");
/** Pick the <option> whose visible text matches a pattern. */
async function selectByText(select, pattern) {
  const value = await select.evaluate((el, src) => {
    const re = new RegExp(src);
    return [...el.options].find((o) => re.test(o.textContent ?? ""))?.value ?? null;
  }, pattern.source);
  assert.ok(value, `no option matching ${pattern}`);
  await select.selectOption(value);
}
const expectToast = (text) => page.getByText(text).first().waitFor();
async function openNewTransaction(type) {
  await page.getByRole("banner").getByRole("button", { name: /new transaction/i }).click();
  await dialog().getByLabel("Transaction type").selectOption(type);
}
async function post() {
  await dialog().getByRole("button", { name: /post transaction/i }).click();
  await expectToast("Transaction posted to the ledger");
  await dialog().waitFor({ state: "detached" });
}
async function trialBalanced() {
  const accts = await api("/api/accounts");
  const dr = accts.reduce((a, x) => a + x.debit, 0);
  const cr = accts.reduce((a, x) => a + x.credit, 0);
  assert.ok(Math.abs(dr - cr) < 0.005, `trial balance off: Dr ${dr} vs Cr ${cr}`);
}

console.log(`UI smoke test against ${BASE}  (${TAG})`);

await step("signed-out visitor is sent to the login page", async () => {
  await page.goto(`${BASE}/transactions`);
  await page.waitForURL(/\/login\?next=%2Ftransactions/);
});

await step("wrong password shows an error", async () => {
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("alert").filter({ hasText: /wrong password/i }).waitFor();
});

await step("correct password signs in and returns to the requested page", async () => {
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${BASE}/transactions`);
  await page.getByRole("heading", { name: "Transactions" }).waitFor();
});

for (const [path, heading] of [["/", "Business overview"], ["/analytics", "Analytics"], ["/inventory", "Inventory"], ["/inventory?tab=parts", "Inventory"], ["/repairs", "Repairs"], ["/expenses", "Expense analysis"], ["/reports", "Reports"], ["/ledger", "General ledger"], ["/audit", "Audit trail"]]) {
  await step(`page loads: ${path}`, async () => {
    const r = await page.goto(BASE + path);
    assert.equal(r.status(), 200);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  });
}

await step("dashboard range switch (MTD) updates the URL", async () => {
  await page.goto(BASE + "/");
  await page.getByRole("radio", { name: "MTD" }).click();
  await page.waitForURL(/range=mtd/);
  await page.getByText("This month · all figures").waitFor();
});

await step("Expense form posts and appears in history", async () => {
  await page.goto(BASE + "/transactions");
  await openNewTransaction("EXPENSE");
  await dialog().getByLabel("Expense category").selectOption("FUEL");
  await dialog().getByLabel("Amount").fill("42.10");
  await dialog().getByLabel("Paid via").selectOption("CARD");
  await dialog().getByLabel(/^Description/).fill(`${TAG} gas`);
  await post();
  await page.getByRole("cell", { name: `${TAG} gas` }).waitFor();
});

await step("Manual journal entry: must balance, then posts", async () => {
  await openNewTransaction("MISC");
  const rows = dialog().locator("div.grid-cols-\\[1fr_88px_88px_36px\\]");
  await rows.nth(0).getByRole("combobox").selectOption("6990");
  await rows.nth(0).getByPlaceholder("Debit").fill("15");
  await rows.nth(1).getByRole("combobox").selectOption("1000");
  await rows.nth(1).getByPlaceholder("Credit").fill("10");
  await dialog().getByText("— must balance").waitFor();
  await rows.nth(1).getByPlaceholder("Credit").fill("15");
  await dialog().getByText("✓ balanced").waitFor();
  await dialog().getByLabel(/^Memo/).fill(`${TAG} journal`);
  await post();
});

const model = `${TAG} Switch V2`;
await step("Device purchase (broken) creates a unit", async () => {
  await openNewTransaction("PURCHASE");
  await dialog().getByLabel("Product line").selectOption("SWITCH");
  await dialog().getByLabel("Condition").selectOption("BROKEN");
  await dialog().getByLabel("Model").fill(model);
  await dialog().getByLabel("Purchase price").fill("55");
  await dialog().getByLabel("Target list price").fill("210");
  await dialog().getByLabel("Bought from").fill(`${TAG} seller`);
  await post();
  const inv = await api("/api/inventory");
  const u = inv.units.find((x) => x.model === model);
  assert.ok(u, "unit not created");
  assert.equal(u.status, "BROKEN");
});

await step("Parts purchase of a brand-new part", async () => {
  await page.goto(BASE + "/inventory?tab=parts");
  await page.getByRole("main").getByRole("button", { name: /buy parts/i }).click();
  await dialog().getByLabel(/^Part(?! )/).selectOption("__new");
  await dialog().getByLabel("New part name").fill(`${TAG} LCD`);
  await dialog().getByLabel("SKU").fill(`PT-${TAG.replace(/\W/g, "")}`);
  await dialog().getByLabel("Quantity").fill("4");
  await dialog().getByLabel("Unit cost").fill("20");
  await post();
  await page.getByRole("cell", { name: `${TAG} LCD` }).waitFor();
});

await step("Refurbish from inventory row: parts + labor capitalised", async () => {
  await page.goto(`${BASE}/inventory?status=BROKEN&q=${encodeURIComponent(TAG)}`);
  await page.getByRole("row", { name: new RegExp(model) }).getByRole("button", { name: /refurbish/i }).click();
  await dialog().getByRole("button", { name: /add part/i }).click();
  const partSelect = dialog().getByRole("combobox").filter({ hasText: "Select part…" });
  await selectByText(partSelect, new RegExp(`${TAG} LCD`));
  await dialog().getByLabel("Technician labor cost").fill("12");
  await post();
  const u = (await api("/api/inventory")).units.find((x) => x.model === model);
  assert.equal(u.status, "READY");
  assert.equal(u.costBasis, 87, `cost basis ${u.costBasis} (expected 55 + 20 + 12)`);
});

await step("Sell from inventory row: price prefilled, profit shown", async () => {
  await page.goto(`${BASE}/inventory?q=${encodeURIComponent(TAG)}`);
  await page.getByRole("row", { name: new RegExp(model) }).getByRole("button", { name: /sell/i }).click();
  await dialog().getByText("Loading").waitFor({ state: "detached" }).catch(() => {});
  assert.equal(await dialog().getByLabel("Sale price").inputValue(), "210");
  await dialog().getByText(/gross profit/).waitFor();
  await dialog().getByRole("combobox", { name: "Customer", exact: true }).fill(`${TAG} buyer`);
  await post();
  const u = (await api("/api/inventory")).units.find((x) => x.model === model);
  assert.equal(u.status, "SOLD");
  assert.equal(u.salePrice, 210);
});

await step("Refund with restock returns the unit to inventory", async () => {
  await openNewTransaction("REFUND");
  await selectByText(dialog().getByLabel("Sold unit (optional)"), new RegExp(model));
  await dialog().getByLabel("Refund amount").fill("210");
  await dialog().getByLabel(/Unit returned/).check();
  await post();
  const u = (await api("/api/inventory")).units.find((x) => x.model === model);
  assert.equal(u.status, "RETURNED");
});

await step("Accessory sale, other income, owner contribution, technician payout", async () => {
  await openNewTransaction("SALE");
  await dialog().getByLabel("Sale price").fill("19.99");
  await dialog().getByLabel(/^Description/).fill(`${TAG} case`);
  await post();
  for (const [type, amt] of [["OTHER_INCOME", "25"], ["OWNER_CONTRIBUTION", "100"], ["WAGES_PAYMENT", "12"]]) {
    await openNewTransaction(type);
    await dialog().getByLabel("Amount").fill(amt);
    await dialog().getByLabel(/^Description/).fill(`${TAG} ${type}`);
    await post();
  }
});

await step("Validation: empty amount is blocked by the form", async () => {
  await openNewTransaction("EXPENSE");
  await dialog().getByRole("button", { name: /post transaction/i }).click();
  assert.equal(await dialog().getByLabel("Amount").evaluate((el) => el.validity.valueMissing), true);
  await page.keyboard.press("Escape");
  await dialog().waitFor({ state: "detached" });
});

let jobUrl;
await step("New repair job with deposit opens the job page", async () => {
  await page.goto(BASE + "/repairs");
  await page.getByRole("button", { name: /new repair job/i }).click();
  await dialog().getByLabel("Customer name").fill(`${TAG} customer`);
  await dialog().getByLabel("Device type").selectOption("SWITCH_OLED");
  await dialog().getByLabel("Problem reported").fill(`${TAG} cracked screen`);
  await dialog().getByLabel("Quoted price").fill("140");
  await dialog().getByLabel("Est. technician labor cost").fill("20");
  await dialog().getByLabel("Deposit taken").fill("40");
  await dialog().getByRole("button", { name: "Create job" }).click();
  await page.waitForURL(/\/repairs\/[a-z0-9]+$/);
  jobUrl = page.url();
  await page.getByText("Deposit held").waitFor();
});

await step("Repair job: add part, step through statuses, complete → invoiced", async () => {
  const sel = page.getByRole("main").getByRole("combobox").last();
  await selectByText(sel, new RegExp(`${TAG} LCD`));
  await page.getByRole("button", { name: "Add part" }).click();
  await expectToast("Part added");
  await page.getByRole("cell", { name: `${TAG} LCD` }).waitFor();
  await page.getByRole("button", { name: /Move to Diagnosing/ }).click();
  await page.getByRole("button", { name: /Move to Waiting for Parts/ }).waitFor();
  await page.getByRole("button", { name: /^Completed$/ }).click();
  await expectToast("Job completed & invoiced");
  await page.getByText("Invoiced", { exact: true }).waitFor();
  await page.getByRole("cell", { name: "Invoice repair job" }).waitFor();
  const id = jobUrl.split("/").pop();
  const job = await api(`/api/repairs/${id}`);
  assert.equal(job.status, "COMPLETED");
  assert.equal(job.invoiced, true);
  assert.equal(Number(job.partsCost), 20);
});

await step("Repair board shows a new job in the Received column", async () => {
  await page.goto(BASE + "/repairs");
  await page.getByRole("button", { name: /new repair job/i }).click();
  await dialog().getByLabel("Customer name").fill(`${TAG} walk-in`);
  await dialog().getByLabel("Problem reported").fill(`${TAG} joy-con drift`);
  await dialog().getByRole("button", { name: "Create job" }).click();
  await page.waitForURL(/\/repairs\/[a-z0-9]+$/);
  await page.goto(BASE + "/repairs");
  await page.getByRole("link", { name: new RegExp(`${TAG} walk-in`) }).first().waitFor();
});

await step("Void a transaction from the history list", async () => {
  await page.goto(`${BASE}/transactions?q=${encodeURIComponent(`${TAG} gas`)}`);
  const row = page.getByRole("row", { name: new RegExp(`${TAG} gas`) });
  await row.getByRole("button", { name: /void/i }).click();
  await dialog().getByLabel("Reason").fill("E2E test void");
  await dialog().getByRole("button", { name: /void transaction/i }).click();
  await expectToast("voided");
  await row.getByText("VOID", { exact: true }).waitFor();
});

await step("Ledger is still balanced after all of the above", trialBalanced);

await step("Report exports download (PDF, Excel, CSV)", async () => {
  await page.goto(BASE + "/reports?period=monthly");
  for (const [name, ext] of [["PDF", "pdf"], ["Excel", "xlsx"], ["CSV", "csv"]]) {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name }).click()]);
    assert.match(dl.suggestedFilename(), new RegExp(`\\.${ext}$`));
    const p = await dl.path();
    assert.ok(p, `${name} download failed`);
  }
  await page.getByLabel("Report date").fill("2026-03-15");
  await page.getByRole("button", { name: "Run" }).click();
  await page.getByText("March 2026", { exact: true }).waitFor();
  for (const period of ["daily", "weekly", "quarterly", "annual"]) {
    await page.getByRole("link", { name: period, exact: true }).click();
    await page.waitForURL(new RegExp(`period=${period}`), { waitUntil: "commit" });
    await page.getByText(new RegExp(`^${period} report$`, "i")).waitFor();
    await page.getByText("Balanced", { exact: true }).waitFor();
  }
});

await step("Ledger account drill-down filters the journal", async () => {
  await page.goto(BASE + "/ledger");
  // the page streams in behind a loading skeleton; click only once the real content is up
  await page.getByRole("heading", { name: "General ledger" }).waitFor();
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /1200 Inventory – Devices/ }).click();
  await page.waitForURL(/account=1200/, { waitUntil: "commit" }); // in-app navigation, no full page load
  await page.getByRole("heading", { name: /Journal · 1200/ }).waitFor();
});

await step("Theme toggle switches to dark mode", async () => {
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
});

await step("Phone width: menu drawer navigates, no sideways scroll", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/inventory", "/repairs", "/transactions", "/reports"]) {
    await page.goto(BASE + path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `${path} scrolls sideways by ${overflow}px`);
  }
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Expenses" }).click();
  await page.waitForURL(/\/expenses/);
  await page.getByRole("button", { name: "Open menu" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Close menu" }).count(), 0, "drawer did not close");
  await page.setViewportSize({ width: 1366, height: 900 });
});

await step("Sign out ends the session", async () => {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  const r = await page.request.get(BASE + "/api/accounts");
  assert.equal(r.status(), 401);
});

await step("No browser console errors on any page", async () => {
  const real = consoleErrors.filter((e) => !/401|Unauthorized|Failed to load resource/.test(e));
  assert.equal(real.length, 0, real.slice(0, 5).join("\n"));
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
