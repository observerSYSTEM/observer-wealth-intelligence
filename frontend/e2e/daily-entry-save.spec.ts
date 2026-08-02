import { expect, test } from "@playwright/test";
import type { Request, Route } from "@playwright/test";

const user = {
  id: "user-e2e",
  email: "owner@example.com",
  display_name: "Owner",
  role: "owner",
  is_active: true,
  is_verified: true,
  last_login_at: "2026-08-02T10:00:00Z",
  timezone: "Europe/London",
  preferred_currency: "GBP",
  created_at: "2026-08-02T09:00:00Z",
  updated_at: "2026-08-02T09:00:00Z"
};

const settings = {
  registration_enabled: false,
  default_timezone: "Europe/London",
  default_currency: "GBP",
  savings_percentage: 50,
  business_percentage: 30,
  living_percentage: 20,
  primary_goal_amount: "100000.00",
  primary_goal_currency: "GBP",
  receipt_ocr_enabled: true,
  theme_preference: "system"
};

function json(route: Route, status: number, payload: unknown) {
  return route.fulfill({
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function dashboardSummary() {
  return {
    tracked_savings: "0.00",
    tracked_savings_currency: "GBP",
    savings_this_month: "0.00",
    savings_this_year: "0.00",
    today_realised_profit: "0.00",
    today_actual_savings: "0.00",
    average_savings_per_eligible_entry: "0.00",
    current_discipline_score: null,
    average_discipline_score: null,
    primary_goal_amount: "100000.00",
    primary_goal_currency: "GBP",
    goal_progress_percentage: "0.00",
    current_streak: 0,
    longest_streak: 0,
    latest_entries: [],
    savings_by_currency: [],
    daily_savings: [],
    monthly_savings: [],
    total_assets: "0.00",
    cash: "0.00",
    investments: "0.00",
    crypto: "0.00",
    property: "0.00",
    business: "0.00",
    trading_accounts: "0.00",
    asset_allocation: [],
    portfolio_growth: [],
    recent_assets: [],
    recent_receipts: [],
    active_goals: [],
    pending_ocr_reviews: 0,
    unread_notifications: 0,
    recent_notifications: [],
    recent_timeline: [],
    latest_backup: null
  };
}

function entryFromPayload(payload: Record<string, unknown>) {
  return {
    id: "e2e-entry-001",
    user_id: user.id,
    entry_date: payload.entry_date,
    recorded_at: "2026-08-02T10:15:00Z",
    recorded_at_local: "2026-08-02T11:15:00+01:00",
    timezone: "Europe/London",
    income_source: payload.income_source,
    realised_profit: payload.realised_profit,
    currency: payload.currency,
    savings_percentage: 50,
    business_percentage: 30,
    living_percentage: 20,
    recommended_savings: "150.00",
    recommended_business: "90.00",
    recommended_living: "60.00",
    actual_savings: payload.actual_savings,
    actual_business: payload.actual_business,
    actual_living: payload.actual_living,
    savings_variance: "0.00",
    discipline_score: 100,
    status: "target_met",
    notes: payload.notes,
    transfer_confirmed: payload.transfer_confirmed,
    receipt_id: payload.receipt_id,
    created_at: "2026-08-02T10:15:00Z",
    updated_at: "2026-08-02T10:15:00Z"
  };
}

test("Daily Entry Save sends POST /api/v1/entries and receives 201", async ({ page }) => {
  const browserErrors: string[] = [];
  const dailyEntryTrace: string[] = [];
  const entryRequests: Request[] = [];
  const savedPayloads: Array<Record<string, unknown>> = [];
  let savedEntry = entryFromPayload({
    entry_date: "2026-08-02",
    income_source: "forex",
    realised_profit: "300.00",
    currency: "GBP",
    actual_savings: "150.00",
    actual_business: "90.00",
    actual_living: "60.00",
    transfer_confirmed: true,
    notes: "",
    receipt_id: null
  });

  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.text().includes("[OWI Daily Entry]")) {
      dailyEntryTrace.push(message.text());
      return;
    }
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("owi:debug-events", "true");
  });

  await page.route("**/api/v1/**", async (route, request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "GET" && path === "/api/v1/auth/setup-status") {
      await json(route, 200, { owner_exists: true, registration_enabled: false });
      return;
    }
    if (method === "GET" && path === "/api/v1/auth/me") {
      await json(route, 200, user);
      return;
    }
    if (method === "GET" && path === "/api/v1/settings") {
      await json(route, 200, settings);
      return;
    }
    if (method === "GET" && path === "/api/v1/dashboard/summary") {
      await json(route, 200, dashboardSummary());
      return;
    }
    if (method === "POST" && path === "/api/v1/entries") {
      entryRequests.push(request);
      const payload = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      savedPayloads.push(payload);
      savedEntry = entryFromPayload(payload);
      await json(route, 201, savedEntry);
      return;
    }
    if (method === "GET" && path === "/api/v1/entries/e2e-entry-001") {
      await json(route, 200, savedEntry);
      return;
    }

    await json(route, 404, { detail: `Unhandled ${method} ${path}` });
  });

  await page.goto("/entries/new");
  await expect(page.locator("section").getByRole("heading", { name: "Daily Entry" })).toBeVisible();
  await expect(page.getByLabel("Realised profit")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

  await page.getByLabel("Realised profit").fill("300.00");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("Actual savings")).toBeVisible();
  await page.getByLabel("Actual savings").fill("150.00");
  await page.getByLabel("Actual business").fill("90.00");
  await page.getByLabel("Actual living").fill("60.00");
  await page.getByLabel("Transfer confirmed").check();
  await page.getByRole("button", { name: "Review" }).click();

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/entries") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save entry" }).click();

  const response = await saveResponse;
  expect(response.status()).toBe(201);
  await expect(page).toHaveURL(/\/entries\/e2e-entry-001$/);

  expect(entryRequests).toHaveLength(1);
  expect(savedPayloads).toHaveLength(1);
  const submittedPayload = savedPayloads[0];
  expect(submittedPayload).toMatchObject({
    realised_profit: "300.00",
    actual_savings: "150.00",
    actual_business: "90.00",
    actual_living: "60.00",
    transfer_confirmed: true
  });
  expect(submittedPayload.idempotency_key).toEqual(expect.any(String));
  expect(dailyEntryTrace.some((item) => item.includes("save button click received"))).toBe(true);
  expect(dailyEntryTrace.some((item) => item.includes("save handler started"))).toBe(true);
  expect(dailyEntryTrace.some((item) => item.includes("entries POST completed"))).toBe(true);
  expect(browserErrors).toEqual([]);
});
