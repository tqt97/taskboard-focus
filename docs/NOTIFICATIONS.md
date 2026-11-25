# Reminder và notification

## Trạng thái hiện tại

### Notification center

Notification center trong header đọc các mốc `Deadline`, `Dev up`, `Staging up` và `Release` của task chưa hoàn tất. Mốc được lọc theo số ngày nhắc đã cấu hình trong **Cài đặt → Thông báo**, có trạng thái chưa xem/đã xem lưu ở localStorage.

### Browser notification

Có thể bật trong **Cài đặt → Thông báo**. Browser sẽ hỏi quyền một lần và gửi mỗi mốc tối đa một lần cho mỗi ngày/mốc/task. Trạng thái gửi được lưu local để tránh lặp khi app re-render.

Giới hạn quan trọng: browser reminder chưa có Service Worker nên chỉ chạy khi workspace đang mở trong một tab và JavaScript đang hoạt động. Đóng toàn bộ tab hoặc máy ngủ thì không thể đánh thức app để gửi nhắc. Persistence IndexedDB không thay đổi giới hạn scheduling này.

### Chatwork test

Trong **Cài đặt → Tích hợp**, nhập Room ID rồi bấm **Gửi thông báo test**. Frontend gọi route `/api/notifications/chatwork-test`; token chỉ đọc từ server environment variable `CHATWORK_API_TOKEN`, không đi qua localStorage hay bundle frontend.

Route gửi `POST https://api.chatwork.com/v2/rooms/{room_id}/messages` với form-urlencoded body và header `x-chatworktoken`. API Chatwork yêu cầu quyền `rooms.messages:write`; lỗi HTTP được chuyển thành thông báo ngắn cho UI, không trả token hoặc response nhạy cảm.

## Cấu hình server

Trong local `.env.local` hoặc Vercel Environment Variables:

```env
CHATWORK_API_TOKEN=your_server_only_token
CHATWORK_ROOM_ID=123456789
TASKBOARD_TIMEZONE=Asia/Ho_Chi_Minh
NOTIFICATION_QUIET_START=22:00
NOTIFICATION_QUIET_END=07:00
```

Room ID hiện được nhập từ UI để hỗ trợ test nhưng phải khớp `CHATWORK_ROOM_ID` đã cấu hình trên server; route không cho gửi tới room tùy ý từ client. Không đặt hai biến này với tiền tố `NEXT_PUBLIC_`.

## Gửi reminder Chatwork định kỳ

Route scheduled notification hiện có idempotency theo `owner_id + run_key + channel`; delivery record theo dõi `pending`, `sent`, `failed`, số lần thử, lease claim ngắn hạn và `next_attempt_at`. Lease ngăn hai cron chạy song song gửi trùng, đồng thời cho phép reclaim nếu process chết giữa chừng. Lỗi thiếu credential hoặc HTTP delivery failure không bị đánh dấu thành công; lần chạy sau sẽ retry theo backoff tối đa 60 phút.
Scheduled route kiểm tra quiet hours server-side theo `TASKBOARD_TIMEZONE`, `NOTIFICATION_QUIET_START` và `NOTIFICATION_QUIET_END`, rồi bỏ qua delivery trong khoảng yên lặng mà không đánh dấu run là `sent`. Browser reminder dùng quiet hours trong Cài đặt → Thông báo.

Muốn bật production reminder đầy đủ cần:

1. Đồng bộ task vào Supabase hoặc repository server-side có `owner_id` theo account.
2. Dùng bảng `notification_runs` hiện có làm delivery log; nếu mở rộng nhiều milestone thì thêm idempotency key dạng `task_id + milestone + local_date + channel`.
3. Tạo Vercel Cron hoặc worker gọi server route/service.
4. Gửi theo lead time, timezone và quiet hours của workspace.
5. Giữ retry lỗi 429/5xx có backoff, nhưng không gửi trùng khi retry.
6. Có audit log trạng thái `pending`, `sent`, `failed`.

Không nên biến route test hiện tại thành endpoint public nhận message tùy ý; cần auth và server-side authorization trước khi mở rộng.
