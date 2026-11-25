# Supabase integration smoke test

Smoke test runtime nằm ở `tests/supabase.integration.test.mts`. Test tạo một workspace tạm, kiểm tra owner/member/viewer, shared task CRUD và xóa workspace sau khi chạy.

## Chuẩn bị

1. Dùng một Supabase project dành riêng cho test, không dùng production.
2. Chạy toàn bộ `supabase/schema.sql` trong SQL Editor.
3. Tạo ba user Auth đã xác nhận email: owner, member và viewer.
4. Điền biến môi trường test trong shell hiện tại hoặc file `.env.test.local`/`.env.local`:

```bash
export TASKBOARD_TEST_SUPABASE_URL="https://your-project.supabase.co"
export TASKBOARD_TEST_SUPABASE_ANON_KEY="your-anon-key"
export TASKBOARD_TEST_OWNER_EMAIL="owner@example.com"
export TASKBOARD_TEST_OWNER_PASSWORD="..."
export TASKBOARD_TEST_MEMBER_EMAIL="member@example.com"
export TASKBOARD_TEST_MEMBER_PASSWORD="..."
export TASKBOARD_TEST_VIEWER_EMAIL="viewer@example.com"
export TASKBOARD_TEST_VIEWER_PASSWORD="..."
```

Chạy:

```bash
npm test -- tests/supabase.integration.test.mts
```

Nếu thiếu bất kỳ biến nào, test sẽ skip thay vì dùng nhầm local mode. Không đặt service-role key vào các biến này; smoke test dùng anon key và Auth session để kiểm tra RLS giống client thật.

`npm run test:supabase:required` tự đọc hai file env trên; biến đã export trong shell luôn được ưu tiên. File chứa password không được commit.
