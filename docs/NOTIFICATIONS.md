# Reminder và notification

## Trạng thái hiện tại

### Notification center

Notification center trong header đọc các mốc `Deadline`, `Dev up`, `Staging up` và `Release` của task chưa hoàn tất. Mốc được lọc theo số ngày nhắc đã cấu hình trong **Cài đặt → Thông báo**, có trạng thái chưa xem/đã xem lưu riêng theo workspace trong localStorage.

### Browser notification

Có thể bật trong **Cài đặt → Thông báo**. Browser sẽ hỏi quyền một lần và gửi mỗi mốc tối đa một lần cho mỗi ngày/mốc/task/workspace. Trạng thái gửi được lưu local theo workspace để tránh lặp khi app re-render hoặc làm mất nhắc ở workspace khác có task ID trùng.

Chọn một notification trong Notification Center sẽ mở task tương ứng. Khi quyền đang bị chặn, trang cài đặt hướng dẫn mở quyền thông báo ở quyền website của trình duyệt hoặc trong cài đặt hệ điều hành nếu dùng app đã cài. Ứng dụng kiểm tra lại quyền khi cửa sổ được focus hoặc tab hiện lại.

Browser reminder cục bộ chỉ chạy khi workspace đang mở trong một tab và JavaScript đang hoạt động. Đóng toàn bộ tab hoặc máy ngủ thì không thể đánh thức app.

### Web Push nền

Owner có thể bật **Nhắc nền khi đóng app** trên thiết bị đã cấp quyền notification. App đăng ký Service Worker `/sw.js`, gửi subscription có xác thực lên Supabase và nhận digest từ `/api/notifications/push`; task phải được đồng bộ cloud. Cron chạy mỗi giờ, quiet hours và lead time dùng cấu hình server. Push hiện chỉ chạy cho `TASKBOARD_OWNER_ID`; member/viewer chưa có notification digest riêng.

### Chatwork test

Trong **Cài đặt → Tích hợp**, nhập Room ID rồi bấm **Gửi thông báo test**. Frontend gọi route `/api/notifications/chatwork-test`; token chỉ đọc từ server environment variable `CHATWORK_API_TOKEN`, không đi qua localStorage hay bundle frontend.

Route gửi `POST https://api.chatwork.com/v2/rooms/{room_id}/messages` với form-urlencoded body và header `x-chatworktoken`. API Chatwork yêu cầu quyền `rooms.messages:write`; lỗi HTTP được chuyển thành thông báo ngắn cho UI, không trả token hoặc response nhạy cảm.

## Cấu hình server

Trong local `.env.local` hoặc Vercel Environment Variables:

```env
CHATWORK_API_TOKEN=your_server_only_token
CHATWORK_ROOM_ID=123456789
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@example.com
TASKBOARD_TIMEZONE=Asia/Ho_Chi_Minh
NOTIFICATION_QUIET_START=22:00
NOTIFICATION_QUIET_END=07:00
```

Room ID nhập từ UI phải khớp `CHATWORK_ROOM_ID` trên server. Gửi test yêu cầu Supabase Auth đúng `TASKBOARD_OWNER_ID` và bị giới hạn một lần mỗi 60 giây qua atomic database claim. Không đặt Chatwork token hoặc VAPID private key với tiền tố `NEXT_PUBLIC_`.

Tạo cặp VAPID bằng `npx web-push generate-vapid-keys`. Cấu hình public key ở `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, private key ở `VAPID_PRIVATE_KEY`, và subject hợp lệ (thường là `mailto:`) ở `VAPID_SUBJECT`. Chạy schema mới nhất để tạo `push_subscriptions` và `claim_notification_test` trước khi bật các nút này.

## Gửi reminder Chatwork định kỳ

Route scheduled notification hiện có idempotency theo `owner_id + run_key + channel`; delivery record theo dõi `pending`, `sent`, `failed`, số lần thử, lease claim ngắn hạn và `next_attempt_at`. Lease ngăn hai cron chạy song song gửi trùng, đồng thời cho phép reclaim nếu process chết giữa chừng. Lỗi thiếu credential hoặc HTTP delivery failure không bị đánh dấu thành công; lần chạy sau sẽ retry theo backoff tối đa 60 phút.
Scheduled route kiểm tra quiet hours server-side theo `TASKBOARD_TIMEZONE`, `NOTIFICATION_QUIET_START` và `NOTIFICATION_QUIET_END`, rồi bỏ qua delivery trong khoảng yên lặng mà không đánh dấu run là `sent`. Browser reminder dùng quiet hours trong Cài đặt → Thông báo.

Cron tạo một digest mỗi ngày theo timezone cấu hình, tránh gửi lại cùng danh sách mỗi giờ. Digest gồm Deadline, Dev up, Staging up và Release; mỗi mốc mặc định nhắc trước 1 ngày. Có thể cấu hình lead time server từ 0 đến 30 ngày bằng `NOTIFICATION_LEAD_DAYS_DEADLINE`, `NOTIFICATION_LEAD_DAYS_DEV_UP`, `NOTIFICATION_LEAD_DAYS_STAGING_UP` và `NOTIFICATION_LEAD_DAYS_RELEASE`. Đây là cấu hình triển khai; lead time trong giao diện browser vẫn riêng trên thiết bị/workspace local.

Muốn bật production reminder đầy đủ cần:

1. Đồng bộ task vào Supabase hoặc repository server-side có `owner_id` theo account.
2. Dùng bảng `notification_runs` hiện có làm delivery log; nếu mở rộng nhiều milestone thì thêm idempotency key dạng `task_id + milestone + local_date + channel`.
3. Tạo Vercel Cron hoặc worker gọi server route/service (route hiện nhóm một digest theo ngày local).
4. Cấu hình lead time server, timezone và quiet hours qua Environment Variables.
5. Giữ retry lỗi 429/5xx có backoff, nhưng không gửi trùng khi retry.
6. Có audit log trạng thái `pending`, `sent`, `failed`.

Không nên biến route test hiện tại thành endpoint public nhận message tùy ý; cần auth và server-side authorization trước khi mở rộng.
