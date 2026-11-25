# Bảo mật và giới hạn

- App MVP lưu dữ liệu ở localStorage; bất kỳ ai dùng cùng profile trình duyệt có thể đọc/sửa dữ liệu.
- Không có API CRUD hoặc Auth thật. Không nhập dữ liệu nhạy cảm.
- `NEXT_PUBLIC_APP_PASSCODE` nếu dùng sẽ được nhúng vào bundle trình duyệt; không phải bí mật và không dùng để bảo vệ dữ liệu. Màn hình lock là affordance giao diện.
- Schema Supabase bật RLS theo `owner_id = auth.uid()` và không cấp quyền anon. Chỉ bật remote sync sau khi cấu hình Auth và test owner isolation.
- Không đặt Supabase service role, Chatwork token hay Gmail credentials trong frontend, repository hoặc file backup.
- Tệp đính kèm binary chỉ upload được ở cloud mode qua Supabase Storage và giới hạn 10 MB; local mode chỉ lưu URL metadata. Trước khi dùng dữ liệu riêng tư cần kiểm tra bucket/policy, MIME, tên file, quyền truy cập và thời hạn URL.
- Import JSON có kiểm tra version và mảng dữ liệu ở UI, nhưng đây là tiện ích cá nhân, chưa chống payload độc hại. Không import file không tin cậy.

## Trước khi dùng cho dữ liệu nhóm

Bắt buộc bổ sung Auth, RLS theo workspace, server-side validation, audit, backup server-side, giới hạn upload, rate limiting, secret management và kiểm thử quyền truy cập.
