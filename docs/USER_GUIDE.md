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
- `N` hoặc nút **Ghi nhanh** mở ô nhập tiêu đề tối giản và lưu task thẳng vào Inbox. Nhấn Enter để lưu; phân loại, giao người và đặt hạn sau.
- Chọn **Focus** để chỉ xem task urgent/high, chờ review, chưa giao hoặc gần/quá hạn.
- Chọn **Lịch & timeline** để xem các mốc Dev up, Staging up, Release và Deadline. **Lịch tuần** phù hợp để xem mốc theo từng ngày; **Timeline release** phù hợp để nhìn toàn bộ task và dependency trên cùng trục thời gian.
- Dùng bộ lọc **Người phụ trách** hoặc **Mốc hiển thị** để thu hẹp thông tin. Kéo mốc **Deadline** sang ngày khác để cập nhật deadline; thay đổi vẫn được lưu vào activity và đồng bộ cloud khi workspace đã đăng nhập.
- Action chính của task đi theo flow: **Bắt đầu** → **Gửi review** → **Hoàn tất**. Task bị chặn sẽ quay lại trạng thái trước đó sau khi **Gỡ chặn**; nếu muốn hoàn tất, cần đi qua bước review.
- Bấm **Chọn nhiều** rồi tick các task để dùng bulk action chuyển sang **Đang làm** hoặc đặt **Ưu tiên cao**; tắt chế độ này để giao diện gọn hơn.
- Chọn **Quản lý template** để đổi tên hoặc xóa template trong workspace hiện tại. Template được lưu trên trình duyệt này và có thể tạo lại từ task chi tiết.
- Trong **Cài đặt → Thông báo**, bật **Nhắc nền khi đóng app** trên thiết bị đã cấp quyền. Cần đăng nhập owner cloud, cài PWA/cho phép push và đồng bộ task; lịch gửi dùng timezone/quiet hours cấu hình server.
- Trên màn hình hẹp, assignee/deadline nằm trong **Bộ lọc nâng cao**. Mã task dùng monospace và có nút copy để dán vào ô tìm kiếm.

## Thành viên

Trong Cài đặt → Đội ngũ, sửa tên/vai trò, ẩn thành viên hoặc thêm người. Thành viên đã ẩn không xuất hiện trong lựa chọn gán mới.

Với cloud workspace, phần **Quyền thành viên cloud** cho phép owner/admin mời bằng email, cập nhật hoặc xóa member theo Supabase user ID. Viewer chỉ xem dữ liệu. Email invite cần cấu hình `SUPABASE_SERVICE_ROLE_KEY` ở server; key này không được đưa vào trình duyệt.

## Sao lưu và chuyển máy

Trong Cài đặt → Dữ liệu, app giữ 7 bản sao tự động theo ngày trên từng workspace. Chọn **Xem và khôi phục** để đưa bản sao qua màn hình preview trước khi áp dụng. App nhắc tải JSON mỗi tuần; lưu file tải xuống sang vị trí an toàn nếu cần bảo vệ khi mất browser profile. Import thay toàn bộ task và thành viên ở trình duyệt hiện tại; luôn kiểm tra preview trước khi xác nhận.

## Dữ liệu và khóa màn hình

Local workspace ưu tiên lưu bất đồng bộ trong IndexedDB; nếu không ghi được, app dùng localStorage dự phòng và hiển thị thông báo. localStorage cũ cũng được đọc để migration. Bản sao tự động nằm trên cùng thiết bị; xóa site data/browser profile có thể làm mất cả workspace lẫn bản sao. Cloud workspace cần Supabase Auth và RLS. Lock screen chỉ là lớp giao diện, không bảo vệ endpoint hay dữ liệu trong DevTools.

## Ngôn ngữ và thiết bị

Trong **Cài đặt → Giao diện**, chọn Tiếng Việt, English hoặc 日本語. Lựa chọn được lưu riêng trên thiết bị; dữ liệu task, enum và backup không phụ thuộc ngôn ngữ. Một số copy nâng cao đang được migrate dần qua catalog để tránh làm thay đổi dữ liệu hiện hữu.
