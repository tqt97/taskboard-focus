# Taskboard Focus upgrades

## Đã triển khai

- `/today` là workspace riêng cho task quá hạn, đến hạn hôm nay và task khẩn; task đã archive không xuất hiện.
- Archive là soft-delete: giữ activity, có undo và restore từ filter `Đã lưu trữ`.
- Local persistence có `boardSchemaVersion`, adapter `BoardStorage` và trạng thái autosave `Đang lưu` / `Đã lưu` / `Lỗi lưu`.
- Dependency readiness được tách thành selector `ready` / `waiting` / `blocked`; parser vẫn chặn missing dependency, self-dependency và cycle.
- Recurrence (`daily`, `weekly`, `monthly`), template flow và utility tạo task kế tiếp; attachment hỗ trợ URL metadata và upload file tối đa 10 MB qua Supabase Storage.
- Supabase Auth helper, `/login`, cloud push/pull và snapshot repository có owner/RLS boundary; snapshot giữ nguyên local ID/dependency graph.
- `/api/notifications` là cron endpoint bảo vệ bằng `CRON_SECRET`; endpoint trả các task active sắp đến hạn từ Supabase service role. Nó không tự gửi email/chat, worker bên ngoài cần dùng response để giao delivery.
- Playwright responsive regression kiểm tra tablet/mobile/right drawer; chạy bằng Chromium desktop/tablet/mobile.

## Giới hạn cần hiểu rõ

- Board hiện vẫn là UI orchestration lớn; selector, storage, repository và domain utility đã được tách trước để tạo seam an toàn. Việc tách toàn bộ JSX thành nhiều component là refactor tiếp theo, không nên làm cùng lúc với migration remote.
- Supabase sync được gọi chủ động bằng nút push/pull: cần cấu hình Auth, `NEXT_PUBLIC_SUPABASE_URL` và anon key. Không đưa service role key vào client.
- Upload binary cần tạo bucket/policies từ `supabase/schema.sql`; local-only mode vẫn dùng URL metadata.
- Template storage đã có adapter, nhưng UI quản lý thư viện template đầy đủ cần một flow riêng để tránh làm modal task quá tải.
- Scheduled endpoint cần `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` và `TASKBOARD_OWNER_ID`; chưa có bằng chứng production delivery.

## Kiểm chứng

```bash
npm run typecheck
npm run test
npm run format:check
npm run test:e2e
npm run build
```

Domain tests hiện có 33 case; Playwright responsive hiện có 6 case chạy trên Chromium desktop/tablet/mobile.
