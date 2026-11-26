# Bảo mật và giới hạn

- Local mode lưu dữ liệu trên trình duyệt (IndexedDB, localStorage là fallback); bất kỳ ai dùng cùng profile trình duyệt có thể đọc/sửa dữ liệu.
- Cloud mode có Supabase Auth, remote task CRUD, workspace membership và RLS theo workspace. Cần chạy schema và kiểm thử bằng project Supabase thật trước khi coi đây là bằng chứng production.
- Khi Supabase được cấu hình, `/login` hỗ trợ password hoặc email OTP 6 số qua Supabase Auth. OTP chỉ là phương thức cấp session Auth; vẫn phải bật RLS và kiểm tra redirect/email template trong project thật.
- Màn hình khóa local dùng OTP passcode 6 số, băm bằng Web Crypto, salt riêng và session unlock trong tab; đây là lớp bảo vệ thao tác trên thiết bị, không phải xác thực server. Người dùng mới được hướng dẫn thiết lập tên/passcode và mặc định tiện lợi là `Anonymous` / `123456` nếu họ chấp nhận.
- Auto-lock có thể cấu hình theo thời gian không hoạt động. Khi session unlock hết hạn, toàn bộ workspace bị phủ bởi lock gate và các action phía dưới không thể thao tác qua UI.
- Không coi passcode client là bí mật tuyệt đối: người có DevTools hoặc quyền đọc local storage vẫn có thể bypass. Dữ liệu cloud vẫn phải được bảo vệ bằng Supabase Auth/RLS.
- Recovery local cho phép reset riêng cấu hình screen lock bằng xác nhận `RESET`; thao tác này không xóa task/workspace nhưng cũng không phải cơ chế xác thực mạnh. Dữ liệu nhạy cảm cần Supabase Auth/RLS.
- Schema Supabase bật RLS theo owner/workspace role và không cấp quyền anon cho dữ liệu ứng dụng. Chỉ bật remote sync sau khi cấu hình Auth, chạy schema và test owner/member/viewer isolation.
- Quyền `member` được sửa task và quan hệ assignment nhưng không được ghi member catalog; chỉ owner/admin được quản lý danh mục thành viên.
- Database trigger và RLS buộc quan hệ `task_assignees` chỉ tham chiếu member cùng workspace với task; assignment chéo workspace bị từ chối ở server, không chỉ ẩn ở UI.
- Khi áp dụng schema lên database cũ, migration dọn các relation chéo workspace hiện hữu trước khi bật guard; các task/member legacy cùng `workspace_id = null` vẫn được giữ.
- Không đặt Supabase service role, Chatwork token hay Gmail credentials trong frontend, repository hoặc file backup.
- Tệp đính kèm binary chỉ upload được ở cloud mode qua Supabase Storage và giới hạn 10 MB; local mode chỉ lưu URL metadata. Trước khi dùng dữ liệu riêng tư cần kiểm tra bucket/policy, MIME, tên file, quyền truy cập và thời hạn URL.
- Import JSON có kiểm tra version và mảng dữ liệu ở UI, nhưng đây là tiện ích cá nhân, chưa chống payload độc hại. Không import file không tin cậy.

## Trước khi dùng cho dữ liệu nhóm hoặc production

Bắt buộc cấu hình Auth/RLS thật, server-side validation, secret management, rate limiting, backup/restore, monitoring và kiểm thử quyền truy cập. Email invite phải đi qua server route với `SUPABASE_SERVICE_ROLE_KEY`; tuyệt đối không đưa key này vào client.

- Chatwork test yêu cầu bearer session của `TASKBOARD_OWNER_ID`, room phải khớp cấu hình server và cooldown 60 giây được claim atomic trong Supabase. Cần áp dụng schema mới nhất để bật route.
- Web Push subscription chỉ cho owner cấu hình; endpoint, `p256dh` và `auth` được lưu trong bảng có RLS. Payload push hiển thị tiêu đề task trong notification hệ điều hành; chỉ bật trên thiết bị cá nhân đáng tin cậy.
- VAPID private key là server secret; chỉ public key có tiền tố `NEXT_PUBLIC_`. Tắt push sẽ xóa subscription server và local; endpoint bị thu hồi được dọn khi Push service trả 404/410.
