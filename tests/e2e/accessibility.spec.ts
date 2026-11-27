import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "taskboard-screen-lock-v2",
      JSON.stringify({
        displayName: "Accessibility User",
        salt: "taskboard-axe-salt",
        passcodeHash: "yYJDCSfixCJpGmLR2EXwjCc6hnMOOi3pZBGhOF7J3mo=",
        autoLockMinutes: 0,
        passcodeLength: 6,
      }),
    );
    sessionStorage.setItem(
      "taskboard-screen-unlocked-until-v2",
      String(Date.now() + 24 * 60 * 60 * 1000),
    );
  });
});

test("tasks page has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: /Danh sách task/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact || ""),
    ),
  ).toEqual([]);
});

test("task dialog has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/tasks");
  await page
    .getByRole("button", {
      name: "Mở task MENSQZIN-248: Hoàn thiện luồng thanh toán",
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Thông tin task" });
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact || ""),
    ),
  ).toEqual([]);
});

for (const route of ["/", "/today", "/drafts", "/inbox", "/timeline"]) {
  test(`${route} has no serious or critical accessibility violations`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page.locator(".app-shell")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations.filter((item) =>
        ["critical", "serious"].includes(item.impact || ""),
      ),
    ).toEqual([]);
  });
}

test("task deep link opens the requested task and clears on close", async ({
  page,
}) => {
  await page.goto("/tasks?task=t1");
  const dialog = page.getByRole("dialog", { name: "Thông tin task" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox").first()).toHaveValue(
    "Hoàn thiện luồng thanh toán",
  );
  await dialog.getByRole("button", { name: "Đóng cửa sổ task" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
});

test("clicking the task backdrop closes the modal once", async ({ page }) => {
  await page.goto("/tasks");
  await page
    .getByRole("button", {
      name: "Mở task MENSQZIN-248: Hoàn thiện luồng thanh toán",
    })
    .click();
  await expect(page.getByRole("dialog", { name: "Thông tin task" })).toBeVisible();
  await page.locator(".overlay").click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole("dialog", { name: "Thông tin task" })).toBeHidden();
  await expect(page).toHaveURL(/\/tasks$/);
});
