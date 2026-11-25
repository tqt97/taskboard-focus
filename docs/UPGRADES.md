# Taskboard Focus upgrades

## Đã triển khai

- App self-host Geist Sans (Latin + Latin Extended/Vietnamese) cho typography nhất quán giữa thiết bị; page heading không lặp eyebrow workspace khi navigation đã có breadcrumb.
- Quick capture qua phím `N` hoặc nút **Ghi nhanh** chỉ yêu cầu tiêu đề và tạo task vào Inbox.
- Local IndexedDB giữ 7 bản sao theo ngày/workspace, xem danh sách và khôi phục qua import preview; JSON export vẫn là bản sao độc lập để chuyển máy.
- Browser reminder recheck permission khi tab quay lại, Notification Center mở task đích; Chatwork digest gồm đủ bốn mốc và chạy tối đa một lần/ngày theo timezone cấu hình.
- Lazy-load Kanban, timeline, notification popover, import/conflict dialog theo nhu cầu; font có content hash và immutable cache một năm. Đồng hồ chỉ cập nhật mỗi phút, chart nhịp tạo task chỉ tính lại khi ngày hoặc task đổi. Build lần rà soát báo First Load JS 203 kB (mốc trước tối ưu 208 kB); phần Board dùng chung vẫn là bundle lớn nhất cần tách tiếp nếu muốn giảm thêm đáng kể.
- Tách UI page heading, quick capture, browser reminder và task card thành component/hook riêng để giảm trách nhiệm của Board.
- Tách lịch sử và thảo luận task khỏi `TaskModal`; state của composer comment được đóng gói trong panel.
- `/today` là workspace riêng cho task quá hạn, đến hạn hôm nay và task khẩn; task đã archive không xuất hiện.
- Archive là soft-delete: giữ activity, có undo và restore từ filter `Đã lưu trữ`.
- Local persistence có `boardSchemaVersion`, adapter `BoardStorage` và trạng thái autosave `Đang lưu` / `Đã lưu` / `Lỗi lưu`.
- Dependency readiness được tách thành selector `ready` / `waiting` / `blocked`; parser vẫn chặn missing dependency, self-dependency và cycle.
- Recurrence (`daily`, `weekly`, `monthly`), template flow và utility tạo task kế tiếp; attachment hỗ trợ URL metadata và upload file tối đa 10 MB qua Supabase Storage.
- Supabase Auth helper, `/login`, workspace catalog, cloud push/pull và snapshot repository có owner/RLS boundary; snapshot giữ nguyên local ID/dependency graph. Remote task CRUD có optimistic revision, offline retry queue và realtime subscription có guard timestamp.
- Workspace settings hỗ trợ role `owner/admin/member/viewer`, mời thành viên qua email bằng server-side Auth/Admin route, cập nhật/xóa member theo user ID; owner membership được bảo vệ bằng database trigger.
- `/api/notifications` là cron endpoint bảo vệ bằng `CRON_SECRET`; endpoint lấy task active sắp đến hạn từ Supabase service role, có dedupe/retry/backoff và server-side quiet hours trước khi gửi Chatwork.
- Playwright responsive regression kiểm tra tablet/mobile/right drawer; chạy bằng Chromium desktop/tablet/mobile.

## Giới hạn cần hiểu rõ

- Board vẫn là UI orchestration lớn; selector, storage, repository, permission và domain utility đã được tách để tạo seam an toàn. Việc tách toàn bộ JSX thành nhiều component là refactor tiếp theo, không nên làm cùng lúc với migration remote.
- Supabase sync được gọi chủ động bằng nút push/pull: cần cấu hình Auth, `NEXT_PUBLIC_SUPABASE_URL` và anon key. Không đưa service role key vào client.
- Upload binary cần tạo bucket/policies từ `supabase/schema.sql`; local-only mode vẫn dùng URL metadata.
- Template storage đã có adapter, nhưng UI quản lý thư viện template đầy đủ cần một flow riêng để tránh làm modal task quá tải.
- Scheduled endpoint cần `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` và `TASKBOARD_OWNER_ID`; email invite cũng cần service role ở server. Chưa có bằng chứng production delivery.

## Kiểm chứng

```bash
npm run typecheck
npm run test
npm run format:check
npm run test:e2e
npm run build
```

Domain tests bao phủ data validation/migration, selectors, recurrence, permissions, search, comments/activity, import/conflict merge, local storage và remote queue. Supabase integration smoke test được tách riêng và yêu cầu project/tài khoản test. Playwright responsive chạy trên Chromium desktop/tablet/mobile; xem kết quả lần chạy hiện tại trong release readiness thay vì dựa vào số case cố định.

Ghi workspace hiện ghi IndexedDB bất đồng bộ trước, chỉ ghi localStorage fallback nếu IndexedDB thất bại để tránh stringify đồng bộ payload lớn mỗi lần sửa task. Đọc localStorage legacy, chuyển workspace và daily snapshot vẫn được giữ.
