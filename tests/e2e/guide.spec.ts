import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("user guide", () => {
  test("renders the guide and passes accessibility checks", async ({ page }) => {
    await page.goto("/guide");

    await expect(
      page.getByRole("heading", {
        name: "Mở Taskboard là biết việc gì cần làm trước.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Mở danh sách task" })).toHaveAttribute(
      "href",
      "/tasks",
    );
    await expect(page.getByRole("link", { name: "Về workspace" })).toHaveAttribute(
      "href",
      "/",
    );

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });
});
