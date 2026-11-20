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

## Supabase (schema chuẩn bị)

- Tạo project, chạy `supabase/schema.sql` trong SQL Editor.
- Schema bật RLS nhưng cố ý không tạo quyền anon. Giao diện hiện tại chưa đồng bộ CRUD với Supabase.
- Trước khi bật adapter: cấu hình Supabase Auth, tạo policies riêng tư, kiểm tra owner isolation rồi mới đưa keys vào Vercel.
- Không dùng service role key trong `NEXT_PUBLIC_*`.

## Chatwork/Gmail

Tích hợp chưa được bật trong MVP. Khi triển khai, token đặt ở server environment variables, endpoint cần xác thực, validate payload, rate limit và ghi log gửi. Cron định kỳ có thể dùng Vercel Cron hoặc Supabase Scheduled Functions; cần kiểm tra giới hạn hiện hành trước khi chọn.
