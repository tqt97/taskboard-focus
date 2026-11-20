# Reminder và notification

## Trạng thái hiện tại

### Notification center

Notification center trong header đọc các mốc `Deadline`, `Dev up`, `Staging up` và `Release` của task chưa hoàn tất. Mốc được lọc theo số ngày nhắc đã cấu hình trong **Cài đặt → Thông báo**, có trạng thái chưa xem/đã xem lưu ở localStorage.

### Browser notification

Có thể bật trong **Cài đặt → Thông báo**. Browser sẽ hỏi quyền một lần và gửi mỗi mốc tối đa một lần cho mỗi ngày/mốc/task. Trạng thái gửi được lưu local để tránh lặp khi app re-render.

Giới hạn quan trọng: vì MVP lưu task trong localStorage và chưa có Service Worker, browser reminder chỉ chạy khi workspace đang mở trong một tab và JavaScript đang hoạt động. Đóng toàn bộ tab hoặc máy ngủ thì không thể đánh thức app để gửi nhắc.

### Chatwork test

Trong **Cài đặt → Tích hợp**, nhập Room ID rồi bấm **Gửi thông báo test**. Frontend gọi route `/api/notifications/chatwork-test`; token chỉ đọc từ server environment variable `CHATWORK_API_TOKEN`, không đi qua localStorage hay bundle frontend.

Route gửi `POST https://api.chatwork.com/v2/rooms/{room_id}/messages` với form-urlencoded body và header `x-chatworktoken`. API Chatwork yêu cầu quyền `rooms.messages:write`; lỗi HTTP được chuyển thành thông báo ngắn cho UI, không trả token hoặc response nhạy cảm.

## Cấu hình server

Trong local `.env.local` hoặc Vercel Environment Variables:

```env
CHATWORK_API_TOKEN=your_server_only_token
CHATWORK_ROOM_ID=123456789
```

Room ID hiện được nhập từ UI để hỗ trợ test nhưng phải khớp `CHATWORK_ROOM_ID` đã cấu hình trên server; route không cho gửi tới room tùy ý từ client. Không đặt hai biến này với tiền tố `NEXT_PUBLIC_`.

## Gửi reminder Chatwork định kỳ

Chưa bật gửi tự động định kỳ trong MVP. Lý do là task hiện chỉ nằm trong localStorage nên server/Cron không thể đọc workspace của trình duyệt. Muốn bật production reminder cần:

1. Đồng bộ task vào Supabase hoặc repository server-side có `owner_id` theo account.
2. Tạo bảng notification delivery log với idempotency key dạng `task_id + milestone + local_date + channel`.
3. Tạo Vercel Cron hoặc worker gọi server route/service.
4. Gửi theo lead time, timezone và quiet hours của workspace.
5. Retry lỗi 429/5xx có backoff, nhưng không gửi trùng khi retry.
6. Có audit log trạng thái `pending`, `sent`, `failed`.

Không nên biến route test hiện tại thành endpoint public nhận message tùy ý; cần auth và server-side authorization trước khi mở rộng.
