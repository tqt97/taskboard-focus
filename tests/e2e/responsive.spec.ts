import { expect, test } from "@playwright/test";

test("task workspace stays usable at tablet width", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: /Danh sách task/ })).toBeVisible();
  await expect(page.locator(".tasks-layout")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");
  await expect(page.locator(".task-code-copy").first()).toBeVisible();
});

test("mobile uses a right-side menu instead of a clipped sidebar control", async ({
  page,
}) => {
  await page.goto("/tasks");
  const menuButton = page.getByRole("button", { name: "Mở menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(
    page.getByRole("navigation", { name: "Điều hướng mobile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Điều hướng mobile" }).getByRole("button", {
      name: "Đóng menu",
    }),
  ).toBeVisible();
});

test("new task modal groups fields and supports multiple dependencies", async ({
  page,
}) => {
  await page.goto("/tasks");
  await page
    .getByRole("button", { name: /Tạo task/i })
    .first()
    .click();

  const dialog = page.getByRole("dialog", { name: "Thêm task mới" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Thông tin task" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(dialog.getByRole("tab", { name: /Lịch sử thay đổi/ })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Thông tin chính" })).toBeVisible();
  await expect(
    dialog.getByText("Dùng khi công việc lặp lại đều đặn", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Có thể chọn nhiều task", { exact: false }),
  ).toBeVisible();
  await expect(dialog.getByText("Chưa có tài liệu hoặc liên kết")).toBeVisible();
  await dialog.getByText("Tài liệu & liên kết").click();
  await expect(dialog.getByText("Chưa có file đính kèm")).toBeVisible();

  await dialog.getByRole("tab", { name: /Lịch sử thay đổi/ }).click();
  await expect(dialog.getByText("Chưa có lịch sử thay đổi")).toBeVisible();
  await dialog.getByRole("tab", { name: "Thông tin task" }).click();
  await expect(dialog.getByRole("heading", { name: "Thông tin chính" })).toBeVisible();

  await dialog.getByRole("button", { name: "Thêm liên kết" }).click();
  await dialog.getByLabel("Mục đích liên kết 1").selectOption("Redmine");
  await dialog.getByLabel("URL liên kết 1").fill("https://example.com/redmine");
  await expect(dialog.getByLabel("Mục đích liên kết 1")).toHaveValue("Redmine");
  const openLink = dialog.getByRole("link", { name: "Mở liên kết 1 trong tab mới" });
  await expect(openLink).toHaveAttribute("target", "_blank");
  await expect(openLink).toHaveAttribute("rel", "noopener noreferrer");

  const dependencyOptions = dialog.locator(".dependency-option input");
  await expect(dependencyOptions).toHaveCount(4);
  await dependencyOptions.nth(0).check();
  await dependencyOptions.nth(1).check();
  await expect(dialog.getByText("2 task đã chọn")).toBeVisible();
});
