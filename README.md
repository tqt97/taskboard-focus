# Taskboard Focus

Ứng dụng web cá nhân để tổng hợp task, theo dõi người phụ trách, ưu tiên, độ nghiêm trọng và các mốc Dev up / Staging up / Release / Deadline. Bản MVP ưu tiên đọc nhanh, thao tác trực tiếp và chuyển dữ liệu giữa máy bằng JSON.

> **Lưu ý:** Đây là bản local-first. Task được lưu trong localStorage của trình duyệt. Supabase schema đã chuẩn bị nhưng CRUD chưa đồng bộ lên Supabase. Không dùng dữ liệu nhạy cảm hoặc chia sẻ public khi chưa bổ sung Auth và RLS.

## Tính năng

- Dashboard có ngày giờ hiện tại, thống kê task và mốc sắp đến.
- Kanban ưu tiên theo thứ tự khẩn cấp → severity → deadline; hỗ trợ kéo thả trong cùng status và qua status khác.
- Chart nhịp tạo task 14 ngày, notification center, export nhanh ở header và sidebar có thể thu gọn.
- Tạo, xem, sửa, xóa task; dialog xác nhận khi xóa.
- Trạng thái, thứ tự ưu tiên, độ nghiêm trọng, thành viên phụ trách.
- Mốc Dev up, Staging up, Release và Deadline; nhắc trực quan task gần/quá hạn.
- Tìm kiếm, lọc trạng thái/ưu tiên, kéo thả đổi thứ tự.
- Chỉnh sửa danh sách thành viên qua UI.
- Dark mode, giao diện responsive.
- Export/import backup JSON schema v1.
- Prefix task cấu hình được, link chính/link phụ, tên hiển thị và passcode lock-screen local.
- Loading/error fallback, validation import/form, keyboard interaction và format code bằng Prettier.
- SEO metadata đầy đủ, icon SVG, Apple icon và web manifest; workspace local vẫn `noindex`.
- Schema Supabase, hướng dẫn Vercel và tài liệu mở rộng.
- GitHub Actions tự kiểm tra pull request và tự deploy production lên Vercel khi push vào `master`.

## Công nghệ

- Next.js 15 App Router, React 19, TypeScript
- CSS riêng, Lucide icons
- LocalStorage cho MVP
- Supabase Postgres schema chuẩn bị cho bước đồng bộ

## Bắt đầu

Yêu cầu Node.js 20.9+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Truy cập http://localhost:3000. Không cần credentials để dùng tính năng local.

```bash
npm run typecheck
npm run build
npm run format:check
```

## Dùng dữ liệu

Mở **Cài đặt → Dữ liệu** để xuất backup JSON hoặc nhập backup trên máy khác. Import thay thế toàn bộ workspace đang mở. Xuất dữ liệu đích trước khi import nếu muốn giữ bản hiện tại.

Dữ liệu local gắn với trình duyệt và profile máy tính. Xóa site data/browser profile có thể xóa workspace; hãy backup định kỳ.

## Deploy Vercel

1. Đẩy repo lên GitHub và import project trong Vercel.
2. Tạo ba GitHub Actions secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
3. Push vào `master`; workflow sẽ chạy format check, typecheck, build rồi deploy production.
4. Xem hướng dẫn chi tiết tại [docs/CI_CD.md](docs/CI_CD.md).
5. Mỗi browser có dữ liệu riêng; dùng JSON backup để chuyển máy.

## Supabase

`supabase/schema.sql` tạo bảng `members`, `tasks`, index và bật RLS. Script không tạo policy anon. Giao diện chưa nối CRUD Supabase. Trước khi thêm đồng bộ:

1. Cấu hình Supabase Auth.
2. Thêm `owner_id` hoặc `workspace_id` và RLS kiểm tra quyền sở hữu.
3. Viết repository adapter và xử lý lỗi đồng bộ.
4. Chỉ dùng anon key ở client khi policies đã được kiểm chứng; không đưa service role key vào frontend.

Xem [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Chatwork, Gmail và tệp đính kèm
UI có mục cấu hình hướng dẫn, nhưng gửi tin nhắn, Gmail và upload attachment chưa được triển khai. Token phải nằm ở server secrets, notification cần scheduler và chống gửi trùng. Xem [docs/ROADMAP.md](docs/ROADMAP.md).

## Màn hình khóa
Lock screen trong MVP chỉ là giao diện tiện ích, không phải xác thực. Mọi giá trị `NEXT_PUBLIC_*` đều có thể đọc trong bundle frontend. Không dùng passcode client để bảo vệ dữ liệu cá nhân trên ứng dụng public.

## Cấu trúc

```text
app/
  _components/
    layout/          Root document, SEO metadata, icons, manifest, loading/error states
    workspace/       Board, task modal, notification popover
  globals.css        Responsive UI và dark mode
  layout.tsx         Thin App Router root entry
  loading.tsx        Thin route loading entry
  error.tsx          Thin route error entry
  page.tsx           Dashboard route entry
  tasks/page.tsx     Task list route entry
lib/
  data.ts            Demo data và localStorage
  supabase.ts        Supabase client placeholder
  types.ts           Domain types
supabase/
  schema.sql         Database schema với RLS mặc định đóng
 docs/
  PRODUCT_SPEC.md    Đặc tả phạm vi và acceptance criteria
  ARCHITECTURE.md    Luồng dữ liệu và thiết kế mở rộng
  USER_GUIDE.md      Hướng dẫn thao tác
  DEPLOYMENT.md      Local, Vercel, Supabase
  SECURITY.md        Giới hạn bảo mật và checklist
  DATA_FORMAT.md     JSON backup schema
  ROADMAP.md         Kế hoạch phiên bản
  CI_CD.md           GitHub Actions và deploy Vercel
```

### Quy ước mở rộng

- Route entries trong `app/` chỉ nên giữ wiring; component UI đặt trong `app/_components/<feature>/`.
- Layout dùng chung đặt trong `app/_components/layout/`; workspace features đặt trong `app/_components/workspace/`.
- Logic dữ liệu, validators và repository adapters đặt trong `lib/`.
- Khi thêm tab mới, tạo feature folder riêng và nối vào route/navigation hiện có thay vì mở rộng thêm một file root lớn.

## Lệnh phát triển

```bash
npm run format       # Format app, lib, docs và package.json
npm run format:check # Kiểm tra format, dùng trong CI
npm run typecheck    # Kiểm tra TypeScript
npm run build        # Build production
```

## Tài liệu

- [Đặc tả sản phẩm](docs/PRODUCT_SPEC.md)
- [Kiến trúc](docs/ARCHITECTURE.md)
- [Hướng dẫn sử dụng](docs/USER_GUIDE.md)
- [Deploy và cấu hình](docs/DEPLOYMENT.md)
- [Bảo mật](docs/SECURITY.md)
- [Định dạng backup](docs/DATA_FORMAT.md)
- [Roadmap](docs/ROADMAP.md)
- [Changelog](CHANGELOG.md)
