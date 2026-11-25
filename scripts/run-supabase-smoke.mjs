import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const loadEnvFile = (fileName) => {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] !== undefined) continue;
    const value = rawValue.trim();
    process.env[name] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
};

loadEnvFile(".env.test.local");
loadEnvFile(".env.local");

const required = [
  "TASKBOARD_TEST_SUPABASE_URL",
  "TASKBOARD_TEST_SUPABASE_ANON_KEY",
  "TASKBOARD_TEST_OWNER_EMAIL",
  "TASKBOARD_TEST_OWNER_PASSWORD",
  "TASKBOARD_TEST_MEMBER_EMAIL",
  "TASKBOARD_TEST_MEMBER_PASSWORD",
  "TASKBOARD_TEST_VIEWER_EMAIL",
  "TASKBOARD_TEST_VIEWER_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(
    `Supabase smoke test cần cấu hình: ${missing.join(", ")}. ` +
      "Dùng npm run test:supabase để chạy chế độ skip an toàn.",
  );
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  [
    "--experimental-default-type=module",
    "--test",
    "tests/supabase.integration.test.mts",
  ],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
