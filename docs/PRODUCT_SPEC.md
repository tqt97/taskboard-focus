# Product Spec — Taskboard Focus

## Mục tiêu

Một workspace cá nhân giúp ghi task nhanh, nhìn tình hình chung và không bỏ lỡ các mốc Dev up, Staging up, Release, Deadline. Trải nghiệm ưu tiên khả năng đọc lướt, ít thao tác, responsive.

## Người dùng và phạm vi

- Một workspace có owner, admin, member và viewer; thành viên cloud là tài khoản Supabase có thể được mời qua email hoặc gán bằng user ID. Danh mục member local vẫn được giữ để backward compatibility và để gán người phụ trách.
- MVP chạy local-first bằng localStorage, không cần cấu hình dịch vụ ngoài.
- Supabase là đích lưu dữ liệu lâu dài khi được cấu hình; workspace cloud có snapshot, remote CRUD từng task, realtime subscription, optimistic revision và RLS theo role.
- Không cung cấp xác thực thật bằng passcode client; lock-screen UI chỉ mang tính tiện lợi.

## Chức năng MVP

1. Dashboard có ngày giờ hiện tại, số lượng task, mốc sắp tới, thành viên.
2. CRUD task với mã, mô tả, trạng thái, ưu tiên, độ nghiêm trọng, người phụ trách, bốn mốc ngày và link tài liệu.
3. Tìm kiếm, lọc trạng thái/ưu tiên, đổi thứ tự bằng kéo thả.
4. Chỉnh sửa danh sách thành viên trên UI, bật/tắt thành viên.
5. Confirm khi xóa task hoặc xóa dữ liệu; nhập dữ liệu có hướng dẫn xác nhận.
6. Export/import JSON versioned; import có preview và chỉ thay thế workspace sau khi người dùng xác nhận.
7. Dark mode, giao diện tiếng Việt, layout responsive.
8. Reminder trực quan theo mốc trong 7 ngày và đánh dấu quá hạn.
9. Focus view, quick capture bằng phím tắt, bulk update và task có bước tiếp theo.
10. Lưu activity history tối giản cho các thay đổi quan trọng của task.

## Nâng cấp sau MVP

- IndexedDB workspace, Inbox/Today action center, triage, checklist, Review/Blocked và quick actions.
- Supabase Auth, CRUD đồng bộ từng task, conflict handling, realtime và RLS theo workspace.
- Upload file vào Supabase Storage với giới hạn MIME/size khi cloud mode đã cấu hình; local MVP chỉ lưu URL metadata.
- Gửi Chatwork qua server-side function và lịch cron; Gmail sau khi có yêu cầu cụ thể.
- Email invite, quyền thành viên, nhiều workspace, signed URL và offline retry queue.

## Tiêu chí chấp nhận

- App chạy với `npm run dev` không cần credentials, dữ liệu local còn sau refresh.
- Thêm/sửa/xóa task cập nhật overview và danh sách ngay lập tức.
- Filter/search hoạt động kết hợp; đổi thứ tự drag-drop được lưu.
- Backup JSON export ra hợp lệ; import kiểm tra schema version và cấu trúc.
- UI dùng được ở viewport 375px trở lên, dialog không tràn viewport.
- Không có secret trong mã frontend hoặc file export.

## Nguyên tắc hiệu quả cá nhân

- Tạo task mới không quá một thao tác chính (`N` hoặc nút tạo task).
- Focus view chỉ giữ task đang mở, urgent/high, đang review, chưa giao hoặc gần/quá hạn.
- Bulk action phải hiển thị số task được chọn và reset selection sau khi hoàn tất.
- Status flow chuẩn là `Chưa làm → Đang làm → Chờ review → Hoàn tất`; `Bị chặn` là nhánh ngoại lệ và lưu trạng thái trước đó để gỡ chặn quay lại đúng bước. Không cho hoàn tất trực tiếp từ `Đang làm` hoặc `Bị chặn`.
- Activity history chỉ giữ các thay đổi gần nhất để không làm phình localStorage.
