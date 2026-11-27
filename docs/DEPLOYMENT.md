# Chạy local và deploy

## Local

Yêu cầu Node.js 20.9+ và npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở http://localhost:3000. Không cần điền biến môi trường để dùng localStorage.

Đây là private workspace app nên metadata đặt `noindex, nofollow`; không cần canonical public cho các route workspace/login. Nếu cần Open Graph URL tuyệt đối cho môi trường nội bộ, đặt `NEXT_PUBLIC_APP_URL` là URL đầy đủ, ví dụ `https://taskboard.example.com`. Khi biến bỏ trống hoặc sai định dạng, app không tự sinh URL `localhost` giả cho metadata.

## Vercel

1. Đưa repo lên GitHub/GitLab.
2. Import repo tại Vercel; framework Next.js được nhận diện tự động.
3. Deploy. Bản local-first không cần biến môi trường.
4. Mỗi máy/trình duyệt có dữ liệu riêng. Export/import JSON để chuyển máy.

Để tự động kiểm tra và deploy sau mỗi push vào `master`, cấu hình GitHub Actions theo [CI_CD.md](CI_CD.md). Không nên bật đồng thời Vercel Git Integration production deployment và job deploy trong Actions vì sẽ tạo hai deployment cho cùng một commit.

## Supabase (schema chuẩn bị)

- Tạo project, chạy `supabase/schema.sql` trong SQL Editor.
- Schema bật RLS, giữ legacy `owner_id` snapshot và có contract multi-workspace qua `workspaces`, `workspace_members`, `workspace_snapshots` và `workspace_id`. Sau khi đăng nhập, UI hỗ trợ workspace catalog, snapshot push/pull, remote CRUD từng task, offline retry queue và role read-only cho viewer.
- Schema hiện phù hợp cho project mới; nếu project Supabase đã có bảng từ trước, phải tạo migration riêng để backfill `owner_id` trước khi đặt `not null`, không chạy mù `create table if not exists` trên dữ liệu production.
- Trước khi bật adapter: cấu hình Supabase Auth, chạy schema, kiểm tra owner/member isolation bằng request authenticated/anonymous và kiểm tra viewer không ghi/xóa rồi mới đưa keys vào Vercel.
- Để bật OTP email: trong Supabase Auth cấu hình Email provider và email template có `{{ .Token }}` (mã 6 số), sau đó đặt `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nếu chưa cấu hình đủ hai biến, tab OTP không hiển thị và local mode vẫn hoạt động.
- Sau khi deploy, kiểm tra email OTP trong project test: gửi mã, nhập mã đúng, mã sai, mã hết hạn và gửi lại trong cooldown. Không dùng service role key ở frontend.
- Không dùng service role key trong `NEXT_PUBLIC_*`.

## Chatwork/Gmail

Chatwork test và scheduled digest cần Auth owner, `TASKBOARD_OWNER_ID`, `CRON_SECRET`, service role và Chatwork credentials. Push nền cần thêm cặp VAPID và schema push subscription. Trên Vercel Hobby, hai cron route chạy một lần/ngày (01:00 và 02:00 UTC); lịch này đáp ứng giới hạn daily của gói. Token và VAPID private key chỉ đặt ở server environment, không dùng `NEXT_PUBLIC_*`. Xem [NOTIFICATIONS.md](NOTIFICATIONS.md).

Gmail chưa triển khai. Cron định kỳ có thể dùng Vercel Cron hoặc Supabase Scheduled Functions; route đã có retry, delivery log và lease idempotency, nhưng vẫn cần cấu hình scheduler/credentials và chạy integration smoke test trước production.
