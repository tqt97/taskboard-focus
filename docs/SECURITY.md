# Bảo mật và giới hạn

- App MVP lưu dữ liệu ở localStorage; bất kỳ ai dùng cùng profile trình duyệt có thể đọc/sửa dữ liệu.
- Không có API CRUD hoặc Auth thật. Không nhập dữ liệu nhạy cảm.
- `NEXT_PUBLIC_APP_PASSCODE` nếu dùng sẽ được nhúng vào bundle trình duyệt; không phải bí mật và không dùng để bảo vệ dữ liệu. Màn hình lock là affordance giao diện.
- Schema Supabase bật RLS nhưng không cấp quyền anon; tránh tình trạng vô tình mở public CRUD. Chỉ thêm policy sau khi bật Auth và có owner/workspace scoping.
- Không đặt Supabase service role, Chatwork token hay Gmail credentials trong frontend, repository hoặc file backup.
- Tệp đính kèm chưa được triển khai; khi thêm cần kiểm tra MIME, dung lượng, tên file, quyền truy cập và thời hạn URL.
- Import JSON có kiểm tra version và mảng dữ liệu ở UI, nhưng đây là tiện ích cá nhân, chưa chống payload độc hại. Không import file không tin cậy.

## Trước khi dùng cho dữ liệu nhóm

Bắt buộc bổ sung Auth, RLS theo workspace, server-side validation, audit, backup server-side, giới hạn upload, rate limiting, secret management và kiểm thử quyền truy cập.
