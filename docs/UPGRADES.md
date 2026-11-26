# Taskboard Focus upgrades

## Đã triển khai

- App self-host Geist Sans (Latin + Latin Extended/Vietnamese) cho typography nhất quán giữa thiết bị; page heading không lặp eyebrow workspace khi navigation đã có breadcrumb.
- Quick capture qua phím `N` hoặc nút **Ghi nhanh** chỉ yêu cầu tiêu đề và tạo task vào Inbox.
- Local IndexedDB giữ 7 bản sao theo ngày/workspace, xem danh sách và khôi phục qua import preview; JSON export vẫn là bản sao độc lập để chuyển máy.
- Browser reminder recheck permission khi tab quay lại, Notification Center mở task đích; Chatwork digest gồm đủ bốn mốc và chạy tối đa một lần/ngày theo timezone cấu hình.
- Web Push nền qua Service Worker cho owner cloud, subscription per-device, VAPID delivery và cron riêng; template có UI đổi tên/xóa trong **Cài đặt → Template**; app nhắc tải JSON ngoài thiết bị mỗi tuần.
- Chatwork test yêu cầu bearer Auth đúng owner, cố định room server-side và cooldown atomic 60 giây trong Supabase.
- Nâng PostCSS lên bản vá bảo mật bằng npm override trong phạm vi Next 15; không ép nâng framework major.
- Lazy-load Kanban, timeline, notification popover, import/conflict dialog theo nhu cầu; font có content hash và immutable cache một năm. Runtime vẫn cập nhật thời gian nội bộ mỗi phút để Today/deadline không stale, nhưng không render đồng hồ ở header. Build lần rà soát 2026-11-26 báo First Load JS khoảng 103 kB và route entry khoảng 1.52 kB; route entries giờ là page thật trong `(workspace)` thay vì `return null`. Bundle analyzer/production trace vẫn cần để xác nhận waterfall thực tế.
- Tách UI page heading, quick capture, browser reminder và task card thành component/hook riêng để giảm trách nhiệm của Board.
- Tách lịch sử và thảo luận task khỏi `TaskModal`; state của composer comment được đóng gói trong panel.
- `/today` là workspace riêng cho task quá hạn, đến hạn hôm nay và task khẩn; task đã archive không xuất hiện.
- Archive là soft-delete: giữ activity, có undo và restore từ filter `Đã lưu trữ`.
- Local persistence có `boardSchemaVersion`, adapter `BoardStorage` và thông báo lỗi persistence rõ ràng; trạng thái lưu nội bộ không chiếm chỗ trong header.
- Dependency readiness được tách thành selector `ready` / `waiting` / `blocked`; parser vẫn chặn missing dependency, self-dependency và cycle.
- Recurrence (`daily`, `weekly`, `monthly`), template flow và utility tạo task kế tiếp; attachment hỗ trợ URL metadata và upload file tối đa 10 MB qua Supabase Storage.
- Supabase Auth helper, `/login`, workspace catalog, cloud push/pull và snapshot repository có owner/RLS boundary; snapshot giữ nguyên local ID/dependency graph. Remote task CRUD có optimistic revision, offline retry queue và realtime subscription có guard timestamp.
- Workspace settings hỗ trợ role `owner/admin/member/viewer`, mời thành viên qua email bằng server-side Auth/Admin route, cập nhật/xóa member theo user ID; owner membership được bảo vệ bằng database trigger.
- `/api/notifications` là cron endpoint bảo vệ bằng `CRON_SECRET`; endpoint lấy task active sắp đến hạn từ Supabase service role, có dedupe/retry/backoff và server-side quiet hours trước khi gửi Chatwork.
- `/api/notifications/push` gửi digest nền qua web push; `/api/notifications/push-subscriptions` chỉ cho owner quản lý subscription. Schema cần áp dụng trước khi bật.
- Playwright responsive regression kiểm tra tablet/mobile/right drawer; chạy bằng Chromium desktop/tablet/mobile.

## Giới hạn cần hiểu rõ

- `WorkspaceRuntime` vẫn là UI orchestration lớn; `WorkspaceLayout`, `WorkspaceProvider`, `WorkspaceSidebar`, `WorkspaceHeader`, selector, storage, repository, permission và domain utility đã được tách thành các seam an toàn. Bước tiếp theo là tách persistence/mutations/permissions sâu hơn khi có profiler evidence, không rewrite toàn bộ cùng lúc với migration remote.
- Supabase sync được gọi chủ động bằng nút push/pull: cần cấu hình Auth, `NEXT_PUBLIC_SUPABASE_URL` và anon key. Không đưa service role key vào client.
- Push reminder chỉ gửi task đã đồng bộ cloud và chỉ cho `TASKBOARD_OWNER_ID`; browser reminder cục bộ vẫn chạy khi tab mở.
- Backup nudge nhắc người dùng tải JSON; việc lưu file ở nơi an toàn vẫn do người dùng thực hiện.
- Upload binary cần tạo bucket/policies từ `supabase/schema.sql`; local-only mode vẫn dùng URL metadata.
- Template storage và UI quản lý thư viện đã có adapter/panel riêng trong **Cài đặt → Template**; luồng tạo task chỉ giữ lựa chọn tạo từ template để không làm page action bị quá tải.
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
