# Bảo mật và giới hạn

- Local mode lưu dữ liệu trên trình duyệt (IndexedDB, localStorage là fallback); bất kỳ ai dùng cùng profile trình duyệt có thể đọc/sửa dữ liệu.
- Cloud mode có Supabase Auth, remote task CRUD, workspace membership và RLS theo workspace. Cần chạy schema và kiểm thử bằng project Supabase thật trước khi coi đây là bằng chứng production.
- `NEXT_PUBLIC_APP_PASSCODE` nếu dùng sẽ được nhúng vào bundle trình duyệt; không phải bí mật và không dùng để bảo vệ dữ liệu. Màn hình lock là affordance giao diện.
- Schema Supabase bật RLS theo owner/workspace role và không cấp quyền anon cho dữ liệu ứng dụng. Chỉ bật remote sync sau khi cấu hình Auth, chạy schema và test owner/member/viewer isolation.
- Quyền `member` được sửa task và quan hệ assignment nhưng không được ghi member catalog; chỉ owner/admin được quản lý danh mục thành viên.
- Database trigger và RLS buộc quan hệ `task_assignees` chỉ tham chiếu member cùng workspace với task; assignment chéo workspace bị từ chối ở server, không chỉ ẩn ở UI.
- Khi áp dụng schema lên database cũ, migration dọn các relation chéo workspace hiện hữu trước khi bật guard; các task/member legacy cùng `workspace_id = null` vẫn được giữ.
- Không đặt Supabase service role, Chatwork token hay Gmail credentials trong frontend, repository hoặc file backup.
- Tệp đính kèm binary chỉ upload được ở cloud mode qua Supabase Storage và giới hạn 10 MB; local mode chỉ lưu URL metadata. Trước khi dùng dữ liệu riêng tư cần kiểm tra bucket/policy, MIME, tên file, quyền truy cập và thời hạn URL.
- Import JSON có kiểm tra version và mảng dữ liệu ở UI, nhưng đây là tiện ích cá nhân, chưa chống payload độc hại. Không import file không tin cậy.

## Trước khi dùng cho dữ liệu nhóm hoặc production

Bắt buộc cấu hình Auth/RLS thật, server-side validation, secret management, rate limiting, backup/restore, monitoring và kiểm thử quyền truy cập. Email invite phải đi qua server route với `SUPABASE_SERVICE_ROLE_KEY`; tuyệt đối không đưa key này vào client.
