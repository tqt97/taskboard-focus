import { expect, test } from "@playwright/test";

test("task workspace stays usable at tablet width", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: /Danh sách task/ })).toBeVisible();
  await expect(page.locator(".tasks-layout")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");
  await expect(page.locator(".task-code-copy").first()).toBeVisible();
  await expect(page.locator(".sync-status")).toBeAttached();
  await expect(page.getByRole("button", { name: "Đổi giao diện" })).toHaveAttribute(
    "title",
  );
  if ((await page.locator(".sync-status").textContent())?.trim() === "Local") {
    await expect(
      page.getByRole("button", { name: "Đẩy workspace lên cloud" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Tải workspace từ cloud" }),
    ).toHaveCount(0);
  }
});

test("mobile uses a right-side menu instead of a clipped sidebar control", async ({
  page,
}) => {
  await page.goto("/tasks");
  const menuButton = page.getByRole("button", { name: "Mở menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click({ force: true });
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
  const snoozeInput = dialog.getByLabel("Hoãn đến");
  await expect(snoozeInput).toBeVisible();
  await dialog.getByRole("button", { name: "1 tuần" }).click();
  await expect(snoozeInput).not.toHaveValue("");
  await expect(dialog.getByText("Chưa có tài liệu hoặc liên kết")).toBeVisible();
  await dialog.getByText("Tài liệu & liên kết").click();
  await expect(dialog.getByText("Chưa có file đính kèm")).toBeVisible();

  const modalBody = dialog.locator(".modal-body");
  const detailsHeight = (await modalBody.boundingBox())?.height || 0;
  await dialog.getByRole("tab", { name: /Lịch sử thay đổi/ }).click();
  await expect(dialog.getByText("Chưa có lịch sử thay đổi")).toBeVisible();
  const historyHeight = (await modalBody.boundingBox())?.height || 0;
  expect(Math.abs(detailsHeight - historyHeight)).toBeLessThan(1);
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

test("inbox shows triage state and checklist controls", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Inbox cần triage" })).toBeVisible();
  await page
    .getByRole("button", { name: /Tạo task/i })
    .first()
    .click();

  const dialog = page.getByRole("dialog", { name: "Thêm task mới" });
  await expect(dialog.getByText("Inbox cần triage")).toBeVisible();
  await expect(
    dialog.getByText("Chia task thành các bước nhỏ", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Thêm bước" }).click();
  await expect(dialog.getByLabel("Nội dung bước 1")).toBeVisible();
  await dialog.getByLabel("Nội dung bước 1").fill("Kiểm tra flow chính");
  await expect(dialog.getByLabel("Hoàn thành bước 1")).toBeVisible();
});

test("import preview can merge a backup without replacing the workspace", async ({
  page,
}, testInfo) => {
  testInfo.skip(
    testInfo.project.name === "chromium-mobile",
    "Mobile settings upload is covered by the desktop/tablet import contract; the mobile panel uses the same component but Playwright file input automation is blocked in this viewport.",
  );
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Cài đặt" }).click({ force: true });
  const settings = page.getByRole("dialog", { name: "Cài đặt" });
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "Dữ liệu" }).click();
  const input = settings.locator('input[type="file"]');
  await input.setInputFiles({
    name: "taskboard-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schema_version: 2,
        tasks: [
          {
            id: "import-only-task",
            code: "IMP-1",
            title: "Task từ backup",
            description: "",
            status: "todo",
            priority: "medium",
            severity: "medium",
            assignee_ids: [],
            assignee_id: "",
            dev_up: "",
            staging_up: "",
            release_at: "",
            deadline: "",
            order_index: 0,
            links: [],
            created_at: "2026-11-25T00:00:00.000Z",
            updated_at: "2026-11-25T00:00:00.000Z",
          },
        ],
        members: [],
      }),
    ),
  });
  const preview = page.getByRole("dialog", { name: "Kiểm tra backup trước khi nhập" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText(/1 task mới/)).toBeVisible();
  await preview.getByRole("button", { name: "Merge đã chọn" }).click();
  await expect(page.getByRole("status")).toContainText("Đã merge backup");
});

test("task discussion supports mention, reply and pin controls", async ({ page }) => {
  await page.goto("/tasks");
  await page
    .getByRole("button", {
      name: "Mở task MENSQZIN-248: Hoàn thiện luồng thanh toán",
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Thông tin task" });
  await dialog.getByRole("tab", { name: /Thảo luận/ }).click();
  await dialog.getByLabel("Mention thành viên").selectOption({ label: "@Linh" });
  await expect(dialog.getByLabel("Nội dung comment")).toHaveValue("@Linh ");
  await dialog.getByLabel("Nội dung comment").fill("@Linh kiểm tra giúp mình");
  await dialog.getByRole("button", { name: "Gửi comment" }).click();
  await expect(dialog.getByText("@Linh kiểm tra giúp mình")).toBeVisible();
  await dialog.getByRole("button", { name: "Trả lời" }).click();
  await expect(dialog.getByText(/Đang trả lời một comment/)).toBeVisible();
  await dialog.getByRole("button", { name: "Ghim" }).click();
  await expect(dialog.getByRole("button", { name: "Bỏ ghim" })).toBeVisible();
});

test("timeline shows milestone calendar and release timeline controls", async ({
  page,
}) => {
  await page.goto("/timeline");
  await expect(page.getByRole("heading", { name: "Lịch & timeline" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tạo task/i })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Lịch tuần/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const timeline = page.getByRole("region", { name: "Lịch và timeline công việc" });
  const legend = timeline.locator(".timeline-legend");
  await expect(legend.getByText("Dev up", { exact: true })).toBeVisible();
  await expect(legend.getByText("Staging up", { exact: true })).toBeVisible();
  await expect(legend.getByText("Release", { exact: true })).toBeVisible();
  await expect(legend.getByText("Deadline", { exact: true })).toBeVisible();
  if ((page.viewportSize()?.width || 0) >= 601) {
    const deadlineEvent = timeline.getByRole("button", { name: /Deadline/ }).first();
    await expect(deadlineEvent).toHaveAttribute("draggable", "true");
    await deadlineEvent.dragTo(timeline.locator(".calendar-day").first());
    await expect(page.getByText(/Đã đổi deadline/)).toBeVisible();
  }
  const timelineTab = page.getByRole("tab", { name: /Timeline release/ });
  await expect(timelineTab).toBeVisible();
  await timelineTab.click({ force: true });
  await expect(timelineTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Task / phụ thuộc")).toBeVisible();
  await expect(
    timeline.locator(".release-milestone.milestone-dev_up").first(),
  ).toHaveAttribute("draggable", "false");
  await expect(page.getByRole("combobox", { name: "Người phụ trách" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Mốc hiển thị" })).toBeVisible();
});

test("local workspace survives a reload through the persistence layer", async ({
  page,
}) => {
  const title = `Persistence check ${Date.now()}`;
  await page.goto("/tasks");
  await page
    .getByRole("button", { name: /Tạo task/i })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Thêm task mới" });
  await dialog.getByLabel("Tên task").fill(title);
  await dialog.getByRole("button", { name: "Lưu task" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("local workspace selector isolates task data between workspaces", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width || 0) < 601,
    "Workspace selector is hidden in the mobile topbar",
  );
  await page.goto("/tasks");
  page.once("dialog", (dialog) => void dialog.accept("QA workspace"));
  await page.getByRole("button", { name: "Tạo workspace" }).click();

  const selector = page.getByRole("combobox", { name: "Chọn workspace" });
  await expect(selector.locator("option", { hasText: "QA workspace" })).toHaveCount(1);
  await selector.selectOption({ label: "QA workspace" });
  await expect(page.getByText("Chưa tìm thấy task")).toBeVisible();
  await selector.selectOption({ label: "Workspace cá nhân" });
  await expect(page.getByText("Hoàn thiện luồng thanh toán")).toBeVisible();
});

test("local workspace keeps templates isolated", async ({ page }) => {
  test.skip(
    (page.viewportSize()?.width || 0) < 601,
    "Workspace selector is hidden in the mobile topbar",
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "taskboard-templates-v1:default",
      JSON.stringify([
        {
          id: "template-default",
          name: "Default workspace template",
          title: "Template task",
          description: "",
          priority: "medium",
          severity: "medium",
          created_at: new Date().toISOString(),
        },
      ]),
    );
  });
  await page.goto("/tasks");
  const templateSelect = page.getByRole("combobox", { name: "Tạo task từ template" });
  await expect(templateSelect).toBeVisible();
  await expect(
    templateSelect.locator("option", { hasText: "Default workspace template" }),
  ).toHaveCount(1);

  page.once("dialog", (dialog) => void dialog.accept("Template workspace"));
  await page.getByRole("button", { name: "Tạo workspace" }).click();
  const workspaceSelect = page.getByRole("combobox", { name: "Chọn workspace" });
  await workspaceSelect.selectOption({ label: "Template workspace" });
  await expect(
    page.getByRole("combobox", { name: "Tạo task từ template" }),
  ).toHaveCount(0);
  await workspaceSelect.selectOption({ label: "Workspace cá nhân" });
  await expect(
    page.getByRole("combobox", { name: "Tạo task từ template" }),
  ).toBeVisible();
});
