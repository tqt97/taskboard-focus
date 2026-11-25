# Changelog

## Unreleased — 2026-11-25

- UI: self-host Geist Sans với hỗ trợ dấu tiếng Việt, đồng bộ font page heading và bỏ eyebrow workspace khỏi các trang.
- Workflow: thêm quick capture qua `N`/nút **Ghi nhanh**, lưu task mới vào Inbox.
- Dữ liệu: tự giữ 7 snapshot local theo ngày/workspace và khôi phục qua preview; JSON export vẫn hỗ trợ backup độc lập.
- Nhắc việc: mở task từ Notification Center, cập nhật lại quyền browser khi quay lại tab, hướng dẫn khôi phục quyền và mở rộng Chatwork digest sang bốn mốc.
- Bảo trì: tách page heading, quick capture, browser reminder và task card thành các component/hook riêng.
- Bảo trì: tách lịch sử và thảo luận task khỏi TaskModal, chuyển trạng thái composer comment vào panel riêng.
- Hiệu năng: lazy-load Kanban, timeline, notification popover, import/conflict dialogs; giảm cập nhật đồng hồ xuống mỗi phút và cache chart theo ngày.
- Cache: self-hosted font assets có tên theo content hash và `Cache-Control: immutable` một năm.
- Hiệu năng dữ liệu: ghi IndexedDB bất đồng bộ trước, chỉ stringify/ghi localStorage fallback khi IndexedDB không ghi được.
- Kết quả build lần rà soát 2026-11-25: First Load JS workspace 203 kB (mốc trước tối ưu 208 kB); phần Board dùng chung vẫn chiếm phần lớn bundle.

## 0.1.2 - 2026-11-20

- Thêm GitHub Actions chạy format check, typecheck và production build.
- Tự deploy Vercel production sau mỗi push vào `master` khi CI pass.
- Thêm tài liệu cấu hình Vercel secrets, project linking, troubleshooting và bảo vệ production.

## 0.1.1 — 2026-11-20

- Tổ chức lại UI theo `app/_components/layout` và `app/_components/workspace`; giữ nguyên route `/` và `/tasks`.
- Thêm layout loading/error dùng chung và metadata tách riêng.
- Hoàn thiện Kanban drag-and-drop trong cùng status và giữa các status.
- Thêm priority/severity legend, creation-frequency chart, notification center và header export.
- Thêm sidebar collapse, sticky topbar, responsive wrapping và dashboard hierarchy.
- Thêm validation form/import, safe localStorage write, deferred search và keyboard-accessible task cards.
- Cài Prettier, thêm `npm run format`, dọn component/state/import không còn dùng.
- Hoàn thiện SEO metadata, favicon SVG, Apple icon và PWA manifest.

## 0.1.0 — 2026-11-20

- Tạo Taskboard Focus local-first với Next.js, React và TypeScript.
- Dashboard overview, deadline timeline, priority/severity, CRUD task, member management.
- Tìm kiếm, lọc, drag reorder, xác nhận xóa, dark mode và responsive layout.
- Export/import JSON schema v1.
- Thêm schema Supabase và tài liệu sản phẩm, kiến trúc, bảo mật, triển khai, hướng dẫn và roadmap.
- Chatwork/Gmail và attachments được mô tả là phần mở rộng; chưa kết nối thực tế.
