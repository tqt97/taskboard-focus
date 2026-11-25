# Roadmap

## v0.1 — Local-first MVP (hiện tại)

- Dashboard, CRUD, lọc/tìm, drag ordering, members, confirm dialogs.
- JSON backup/restore, dark mode, responsive, deadline overview.
- Supabase schema và hướng dẫn tích hợp.
- Focus view, quick capture, saved views, bulk update, undo, dependency, workload và activity history đã bắt đầu đi vào local-first workflow.
- P0 completion workflow: `Review`/`Blocked` tách riêng, Inbox triage, Today action center, checklist/subtask, quick start/complete/snooze và activity diff.
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

## Ngoài phạm vi hiện tại

- Multi-tenant SaaS, native push.

## Trạng thái triển khai

P0 và phần lớn P1 đã có code/test local/E2E. P2 đã có contract chạy được cho local/cloud workspace, role-aware schema, remote CRUD queue, conditional conflict guard và lazy/windowed card rendering. Chưa tuyên bố hoàn tất remote collaboration vì chưa có Supabase integration test và kiểm chứng race condition đa client trên backend thật.
