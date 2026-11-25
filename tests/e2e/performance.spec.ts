import { expect, test } from "@playwright/test";

const makeBoard = (size: number) => ({
  tasks: Array.from({ length: size }, (_, index) => ({
    id: `perf-${index}`,
    code: `PERF-${index}`,
    title: `Payment task ${index}`,
    description: "Browser performance benchmark",
    status: index % 5 === 0 ? "review" : "in_progress",
    priority: index % 17 === 0 ? "urgent" : "medium",
    severity: "medium",
    assignee_ids: [],
    assignee_id: "",
    dev_up: "",
    staging_up: "",
    release_at: "",
    deadline: "",
    order_index: index,
    links: [],
    primary_links: [],
    secondary_links: [],
    activity: [],
    comments: Array.from({ length: index % 3 }, (_, commentIndex) => ({
      id: `comment-${index}-${commentIndex}`,
      body: "benchmark comment",
      mention_ids: [],
      created_at: "2026-11-25T00:00:00.000Z",
    })),
    checklist: Array.from({ length: index % 6 }, (_, checklistIndex) => ({
      id: `check-${index}-${checklistIndex}`,
      title: "benchmark checklist item",
      done: checklistIndex % 2 === 0,
    })),
    attachments: Array.from({ length: index % 3 }, (_, attachmentIndex) => ({
      id: `attachment-${index}-${attachmentIndex}`,
      name: "benchmark.txt",
      url: "https://example.test/benchmark.txt",
    })),
    created_at: "2026-11-25T00:00:00.000Z",
    updated_at: "2026-11-25T00:00:00.000Z",
  })),
  members: [],
  code_prefix: "PERF-",
  sort_mode: "smart",
});

test.describe("browser performance benchmark", () => {
  test.describe.configure({ timeout: 120_000 });

  test("measures 100, 1000 and 10000 tasks across core interactions", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "chromium-desktop",
      "Run the expensive benchmark on desktop only.",
    );
    const results: Array<Record<string, number>> = [];
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: /Danh sách task/ })).toBeVisible();
    await page.waitForTimeout(350);

    for (const size of [100, 1000, 10000]) {
      const board = makeBoard(size);
      await page.evaluate(async (value) => {
        window.localStorage.clear();
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("taskboard-focus-v2", 2);
          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("workspace")) {
              request.result.createObjectStore("workspace");
            }
            if (!request.result.objectStoreNames.contains("daily-backups")) {
              request.result.createObjectStore("daily-backups");
            }
          };
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("workspace", "readwrite");
            transaction.objectStore("workspace").put(
              {
                id: "default",
                name: "Benchmark",
                updatedAt: new Date().toISOString(),
                data: value,
              },
              "default",
            );
            transaction.oncomplete = () => {
              database.close();
              resolve();
            };
            transaction.onerror = () => reject(transaction.error);
          };
        });
      }, board);
      const loadStarted = Date.now();
      await page.reload();
      await expect(page.getByRole("heading", { name: /Danh sách task/ })).toBeVisible();
      await expect(page.locator(".tasks-panel .panel-heading p")).toContainText(
        `${size} task`,
      );
      const loadMs = Date.now() - loadStarted;

      const searchBox = page.getByRole("textbox", { name: "Ctrl/⌘ K" });
      const searchStarted = Date.now();
      await searchBox.fill(`Payment task ${size - 1}`);
      const matchingCard = page
        .locator(".task-card")
        .filter({ hasText: `Payment task ${size - 1}` });
      const matchingColumn = page
        .locator(".kanban-column")
        .filter({ hasText: size - 1 === 0 ? "Chờ review" : "Đang làm" })
        .first();
      await matchingColumn
        .locator(".task-render-item")
        .first()
        .scrollIntoViewIfNeeded();
      await expect.poll(() => matchingCard.count(), { timeout: 10_000 }).toBe(1);
      const searchMs = Date.now() - searchStarted;

      const taskButton = page.getByRole("button", {
        name: `Mở task PERF-${size - 1}: Payment task ${size - 1}`,
      });
      const modalStarted = Date.now();
      await taskButton.click();
      const dialog = page.getByRole("dialog", { name: "Thông tin task" });
      await expect(dialog).toBeVisible();
      const modalMs = Date.now() - modalStarted;
      expect(await dialog.locator(".dependency-option").count()).toBeLessThanOrEqual(
        100,
      );
      let dependencySearchMs = 0;
      if (size === 10000) {
        const dependencySearch = dialog.getByRole("searchbox", {
          name: "Tìm task phụ thuộc",
        });
        const dependencyStarted = Date.now();
        await dependencySearch.fill("Payment task 5000");
        await expect(dialog.locator(".dependency-option")).toHaveCount(1);
        dependencySearchMs = Date.now() - dependencyStarted;
      }
      const tabStarted = Date.now();
      await dialog.getByRole("tab", { name: /Lịch sử thay đổi/ }).click();
      await expect(dialog.getByText("Chưa có lịch sử thay đổi")).toBeVisible();
      const tabMs = Date.now() - tabStarted;
      results.push({ size, loadMs, searchMs, modalMs, dependencySearchMs, tabMs });
      console.log(`[browser-benchmark] ${JSON.stringify(results.at(-1))}`);
      await page.getByRole("button", { name: "Đóng cửa sổ task" }).click();
    }

    expect(results).toHaveLength(3);
  });
});
