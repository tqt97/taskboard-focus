# Hướng dẫn sử dụng

## Tạo và sửa task

- Chọn **Tạo task**, điền tên bắt buộc; các trường khác có thể bổ sung sau.
- Ưu tiên thể hiện thứ tự xử lý; nghiêm trọng thể hiện mức tác động nếu chậm/lỗi.
- Gán thành viên và nhập các mốc. Task quá hạn hiện màu đỏ; mốc trong 3 ngày hiện màu cam.
- Bấm thẻ task để mở chi tiết. Xóa có bước xác nhận.

## Tìm và sắp xếp

- Tìm theo mã, tiêu đề, mô tả.
- Lọc trạng thái và ưu tiên độc lập.
- Lọc thêm theo người phụ trách, task chưa giao và deadline quá hạn/hôm nay/7 ngày tới.
- Kéo thẻ task để thay đổi thứ tự hiển thị. Thứ tự này không tự đổi priority.
- Nhấn `N` để tạo task nhanh; nhấn `Ctrl/Cmd + K` để focus ô tìm kiếm.
- Chọn **Focus** để chỉ xem task urgent/high, đang review, chưa giao hoặc gần/quá hạn.
- Bấm **Chọn nhiều** rồi tick các task để dùng bulk action chuyển sang **Đang làm** hoặc đặt **Ưu tiên cao**; tắt chế độ này để giao diện gọn hơn.
- Trên màn hình hẹp, assignee/deadline nằm trong **Bộ lọc nâng cao**. Mã task dùng monospace và có nút copy để dán vào ô tìm kiếm.

## Thành viên

Trong Cài đặt → Đội ngũ, sửa tên/vai trò, ẩn thành viên hoặc thêm người. Thành viên đã ẩn không xuất hiện trong lựa chọn gán mới.

Với cloud workspace, phần **Quyền thành viên cloud** cho phép owner/admin mời bằng email, cập nhật hoặc xóa member theo Supabase user ID. Viewer chỉ xem dữ liệu. Email invite cần cấu hình `SUPABASE_SERVICE_ROLE_KEY` ở server; key này không được đưa vào trình duyệt.

## Sao lưu và chuyển máy

Trong Cài đặt → Dữ liệu, xuất JSON. Trên máy khác mở app và nhập file. Import thay toàn bộ task và thành viên ở trình duyệt hiện tại; hãy export dữ liệu đích trước khi nhập.

## Dữ liệu và khóa màn hình

Local workspace ưu tiên lưu trong IndexedDB và giữ localStorage làm fallback/migration. Xóa dữ liệu trình duyệt có thể làm mất workspace nếu chưa backup. Cloud workspace cần Supabase Auth và RLS. Lock screen chỉ là lớp giao diện, không bảo vệ endpoint hay dữ liệu trong DevTools.

## Ngôn ngữ và thiết bị

Trong **Cài đặt → Giao diện**, chọn Tiếng Việt, English hoặc 日本語. Lựa chọn được lưu riêng trên thiết bị; dữ liệu task, enum và backup không phụ thuộc ngôn ngữ. Một số copy nâng cao đang được migrate dần qua catalog để tránh làm thay đổi dữ liệu hiện hữu.
