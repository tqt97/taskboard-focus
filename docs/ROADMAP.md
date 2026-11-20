# Roadmap

## v0.1 — Local-first MVP (hiện tại)

- Dashboard, CRUD, lọc/tìm, drag ordering, members, confirm dialogs.
- JSON backup/restore, dark mode, responsive, deadline overview.
- Supabase schema và hướng dẫn tích hợp.

## v0.2 — Đồng bộ có xác thực

- Supabase Auth, private RLS, remote repository adapter.
- Trạng thái đồng bộ, lỗi/retry, concurrency policy.

## v0.3 — Notification

- Browser reminder, cấu hình lead time và notification center đã có ở MVP.
- Chatwork server-side test endpoint đã có; scheduled job + dedupe log vẫn cần backend remote.
- Cấu hình quiet hours và lịch gửi production.
- Gmail nếu xác định sender/auth provider.

## v0.4 — Tài liệu và cộng tác

- Upload/download attachments với Storage policy.
- Soft delete/restore, history, import preview và merge strategy.

## Ngoài phạm vi hiện tại

- Multi-tenant SaaS, phân quyền phức tạp, realtime collaboration, native push.
