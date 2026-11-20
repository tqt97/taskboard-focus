# Chạy local và deploy

## Local

Yêu cầu Node.js 20.9+ và npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở http://localhost:3000. Không cần điền biến môi trường để dùng localStorage.

## Vercel

1. Đưa repo lên GitHub/GitLab.
2. Import repo tại Vercel; framework Next.js được nhận diện tự động.
3. Deploy. Bản local-first không cần biến môi trường.
4. Mỗi máy/trình duyệt có dữ liệu riêng. Export/import JSON để chuyển máy.

Để tự động kiểm tra và deploy sau mỗi push vào `master`, cấu hình GitHub Actions theo [CI_CD.md](CI_CD.md). Không nên bật đồng thời Vercel Git Integration production deployment và job deploy trong Actions vì sẽ tạo hai deployment cho cùng một commit.

## Supabase (schema chuẩn bị)

- Tạo project, chạy `supabase/schema.sql` trong SQL Editor.
- Schema bật RLS nhưng cố ý không tạo quyền anon. Giao diện hiện tại chưa đồng bộ CRUD với Supabase.
- Trước khi bật adapter: cấu hình Supabase Auth, tạo policies riêng tư, kiểm tra owner isolation rồi mới đưa keys vào Vercel.
- Không dùng service role key trong `NEXT_PUBLIC_*`.

## Chatwork/Gmail

Chatwork đã có server route gửi thông báo test tại `/api/notifications/chatwork-test`. Token đặt ở server environment variables, không dùng `NEXT_PUBLIC_*`. Reminder Chatwork định kỳ chưa bật vì task MVP chỉ nằm trong localStorage; cần repository server-side, scheduler, auth, rate limit và delivery log trước khi triển khai. Xem [NOTIFICATIONS.md](NOTIFICATIONS.md).

Gmail chưa triển khai. Cron định kỳ có thể dùng Vercel Cron hoặc Supabase Scheduled Functions sau khi hoàn thiện dữ liệu remote và idempotency.
