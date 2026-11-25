# Roadmap

## v0.1 — Local-first MVP (hiện tại)

- Dashboard, CRUD, lọc/tìm, drag ordering, members, confirm dialogs.
- JSON backup/restore, dark mode, responsive, deadline overview.
- Supabase schema và hướng dẫn tích hợp.
- Focus view, quick capture, saved views, bulk update, undo, dependency, workload và activity history đã bắt đầu đi vào local-first workflow.
- P0 completion workflow: `Review`/`Blocked` tách riêng, Inbox triage, Today action center, checklist/subtask, quick start/complete/snooze và activity diff.
- Calendar/Timeline `/timeline` hiển thị các mốc Dev up, Staging up, Release và Deadline theo tuần hoặc trục release; có filter assignee/milestone và kéo Deadline để cập nhật task.
- Import backup có preview/xác nhận; task cũ được migrate không đổi identity.
- IndexedDB persistence đã được thêm với localStorage fallback để tăng quota và giảm phụ thuộc vào chuỗi JSON đồng bộ.
- Local workspace selector đã tách dữ liệu từng workspace; cloud workspace catalog/snapshot được tách qua `workspace_id` khi Supabase được cấu hình.

## v0.2 — Đồng bộ có xác thực

- Hoàn thiện Supabase Auth, private RLS và single-account `owner_id` contract cho production.
- Snapshot repository hiện có optimistic revision check; conflict hiện báo rõ và yêu cầu Pull trước khi Push.
- Remote task repository đã có contract `list/upsert/remove`, mapping quan hệ assignee/checklist/attachment; Board đã queue upsert cho create/update/quick action khi cloud đăng nhập, còn snapshot sync vẫn là fallback toàn workspace.
- Remote task mutation có offline queue, dedupe theo task, retry backoff và flush khi online; conflict không retry vô hạn mà chuyển sang paused queue item; cần integration test với Supabase thật.

## v0.3 — Notification

- Browser reminder, cấu hình lead time và notification center đã có ở MVP.
- Chatwork server-side test endpoint và scheduled route đã có; `notification_runs` ghi delivery state, retry backoff và lease chống gửi trùng. Cần bật scheduler và kiểm chứng runtime trên Supabase thật.
- Cấu hình quiet hours và lịch gửi production.
- Gmail nếu xác định sender/auth provider.

## v0.4 — Tài liệu và cộng tác

- Attachment upload dùng private bucket + signed URL metadata, tự dọn object khi người dùng xóa metadata; signed URL refresh khi mở task, cloud workspace dùng path theo workspace và Storage RLS phân biệt quyền đọc/ghi.
- Soft delete/restore, history, import preview và merge strategy.

## P2 — Scale và cộng tác

- IndexedDB, workspace selector, remote workspace repository, remote CRUD từng task và guarded realtime subscription đã có.
- Permission contract + RLS role-aware (`owner/admin/member/viewer`) đã có; UI local cho phép tách access role khỏi job role.
- Cloud settings đã có list/update/remove member theo user ID, email invite qua server-side Supabase Auth/Admin và bảo vệ owner membership.
- Browser rendering đã có lazy/windowed card rendering với overscan và `content-visibility`; cần benchmark thêm cho card height biến thiên ở dataset cực lớn.
- Realtime conflict resolution có conditional `updated_at` write, `REPLICA IDENTITY FULL` cho stale-delete, shared workspace CRUD không còn giới hạn theo người tạo task, và không nhận event cũ hơn local; atomic server/runtime integration test vẫn cần môi trường Supabase thật.
- Comment theo task đã tách khỏi activity history: mention, reply, pin và notification mention; deadline/mốc trong activity được format theo locale thay vì hiển thị ISO thô.
- Conflict Center đã có compare local/remote, merge từng field, chọn giữ local/lấy remote và blocked queue riêng; thao tác ghi đè remote chỉ chạy sau xác nhận rõ ràng.
- Có `npm run benchmark` đo workload 100/1.000/10.000 task gồm tạo dữ liệu, search khi gõ, realtime update và serialize backup; `npm run benchmark:e2e` đo trực tiếp qua IndexedDB trong browser cả load/search/mở modal/chuyển tab. Baseline lần chạy hiện tại ở 10.000 task là khoảng 1.24s/498ms/739ms/182ms; cần theo dõi thêm card height biến thiên trước khi chốt ngưỡng production.
- Import backup đã có preview conflict, merge từng task và lựa chọn thay thế toàn bộ; các thao tác import đều đi qua undo window.
- Next Action, activity diff và import merge/preview được tách thành domain modules để tiếp tục refactor `Board.tsx` theo seam, không rewrite một lần.

## Ngoài phạm vi hiện tại

- Multi-tenant SaaS, native push.

## Trạng thái triển khai

P0 và phần lớn P1 đã có code/test local/E2E. P2 đã có contract chạy được cho local/cloud workspace, role-aware schema, remote CRUD queue, conditional conflict guard và lazy/windowed card rendering. Chưa tuyên bố hoàn tất remote collaboration vì chưa có Supabase integration test và kiểm chứng race condition đa client trên backend thật.

## Ưu tiên sau rà soát 2026-11-25

1. **P0 — xác minh luồng lưu:** bổ sung kiểm tra browser cho IndexedDB primary, localStorage fallback, workspace switch và daily backup. Unit tests hiện kiểm tra localStorage scope; Playwright chưa chạy được trên máy rà soát vì thiếu Chromium.
2. **P1 — giảm bundle theo route:** `Board` vẫn được import trên mọi route workspace nên shared First Load JS là khoảng 203 kB. Tách state/data orchestration khỏi view-specific UI, sau đó cho `/timeline`, `/inbox`, `/today` và `/tasks` tải đúng feature của route; đo lại build trước/sau mỗi nhánh.
3. **P1 — giảm rủi ro bảo trì:** tiếp tục tách `Board` theo seams rõ ràng (toolbar/navigation, dashboard analytics, task list, workspace settings) và thêm test cho storage fallback. Giữ các domain rules trong `lib/taskboard/`, tránh chuyển logic nghiệp vụ vào component.
4. **P1 — hoàn tất cloud gate:** chạy `npm run test:supabase:required` với project test, owner/member/viewer và multi-client race; chỉ sau đó nâng trạng thái cloud collaboration từ contract sang runtime-verified.
5. **P1 — bảo vệ notification test:** Chatwork test giờ yêu cầu owner Auth, room cố định và atomic cooldown 60 giây; cần chạy integration test với project Supabase.
6. **P1 — kiểm chứng Web Push:** subscription, Service Worker, VAPID delivery và cron route đã có; cần bật env/schema và xác minh nhận banner trên thiết bị đã cài PWA.
7. **P2 — quản lý template:** UI đổi tên/xóa template đã được thêm; tiếp theo có thể thêm tag/danh mục nếu thư viện lớn.
8. **P2 — backup ngoài thiết bị:** app nhắc tải JSON mỗi tuần nhưng backup vẫn do người dùng chủ động lưu; có thể thêm provider cloud backup có mã hóa đầu cuối.

Không đưa server cache vào dữ liệu task/workspace cá nhân vì dữ liệu phụ thuộc account và thay đổi thường xuyên. Cache dài hạn phù hợp với font/static assets; cache dữ liệu cloud cần account-scoped invalidation trước khi thêm.
