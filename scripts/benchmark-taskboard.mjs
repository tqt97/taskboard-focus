import { performance } from "node:perf_hooks";

const sizes = [100, 1000, 10000];
const makeTask = (index) => ({
  id: `task-${index}`,
  title: `Task ${index} payment flow`,
  description: "benchmark task",
  status: index % 5 === 0 ? "review" : "in_progress",
  priority: index % 17 === 0 ? "urgent" : "medium",
  deadline: index % 11 === 0 ? "2026-11-26T10:00:00.000Z" : "",
  checklist: Array.from({ length: index % 8 }, (_, item) => ({
    id: `${index}-${item}`,
    done: item % 2 === 0,
  })),
  attachments: Array.from({ length: index % 5 }, (_, item) => ({
    id: `${index}-${item}`,
    url: `https://example.test/${index}/${item}`,
  })),
});
const measure = (label, fn) => {
  const start = performance.now();
  const value = fn();
  return { label, ms: Number((performance.now() - start).toFixed(2)), value };
};
for (const size of sizes) {
  const generated = measure("generate", () =>
    Array.from({ length: size }, (_, index) => makeTask(index)),
  );
  const tasks = generated.value;
  const search = measure("search while typing", () =>
    tasks.filter((task) =>
      `${task.title} ${task.description}`.toLowerCase().includes("payment"),
    ),
  );
  const realtime = measure("realtime update", () =>
    tasks.map((task, index) =>
      index === Math.floor(size / 2)
        ? { ...task, updated_at: new Date().toISOString() }
        : task,
    ),
  );
  const serialize = measure("serialize backup", () => JSON.stringify(tasks));
  console.log(
    JSON.stringify({
      size,
      generate_ms: generated.ms,
      search_ms: search.ms,
      realtime_ms: realtime.ms,
      serialize_ms: serialize.ms,
      matched: search.value.length,
      bytes: serialize.value.length,
    }),
  );
}
