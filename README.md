# Taskboard Focus

Ứng dụng web cá nhân để tổng hợp task, theo dõi người phụ trách, ưu tiên, độ nghiêm trọng và các mốc Dev up / Staging up / Release / Deadline. Bản MVP ưu tiên đọc nhanh, thao tác trực tiếp và chuyển dữ liệu giữa máy bằng JSON.

> **Lưu ý:** Mặc định vẫn là local-first. Task được lưu qua storage adapter ưu tiên IndexedDB và fallback về localStorage; Supabase/Auth, cron và remote repository là các lớp opt-in cần cấu hình credentials và kiểm chứng RLS trước khi dùng.

## Tính năng

- Dashboard có ngày giờ hiện tại, thống kê task và mốc sắp đến.
- Kanban ưu tiên theo thứ tự khẩn cấp → severity → deadline; hỗ trợ kéo thả trong cùng status và qua status khác.
- Chart nhịp tạo task 14 ngày, notification center, export nhanh ở header và sidebar có thể thu gọn.
- Tạo, xem, sửa, xóa task; dialog xác nhận khi xóa.
- Trạng thái, thứ tự ưu tiên, độ nghiêm trọng, thành viên phụ trách.
- Mốc Dev up, Staging up, Release và Deadline; nhắc trực quan task gần/quá hạn.
- Tìm kiếm, lọc trạng thái/ưu tiên, kéo thả đổi thứ tự.
- Focus view cho task cần xử lý, phím tắt `N` tạo task và `Ctrl/Cmd + K` focus tìm kiếm.
- Chọn nhiều task để đổi trạng thái hoặc ưu tiên cùng lúc.
- Bước tiếp theo, ghi chú review và activity history tối giản trên từng task.
- Chỉnh sửa danh sách thành viên qua UI.
- Dark mode, giao diện responsive.
- Today workspace tại `/today`, archive/restore soft-delete và autosave status.
- Dependency readiness, recurrence, attachment URL metadata và template storage utility.
- Supabase Storage upload attachment tối đa 10 MB khi đã đăng nhập cloud.
- Playwright responsive regression cho desktop/tablet/mobile.
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
npm run test
npm run build
npm run format:check
npm run test:e2e
# hoặc chạy toàn bộ check liên tiếp
npm run check
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

`supabase/schema.sql` tạo bảng `members`, `tasks`, `workspaces`, `workspace_members`, `workspace_snapshots`, index và role-aware RLS. `/login` và nút cloud hỗ trợ catalog workspace, snapshot theo workspace, remote task CRUD, phân quyền thành viên và email invite server-side; snapshot `owner_id` cũ vẫn được giữ để backward compatibility. Trước khi bật remote sync:

1. Cấu hình Supabase Auth.
2. Dùng `owner_id = auth.uid()` và kiểm tra RLS bằng cả request authenticated/anonymous.
3. Kiểm tra workspace catalog, role (`owner/admin/member/viewer`), RLS và xử lý lỗi đồng bộ; UI có nút push/pull cloud và queue retry cho task mutation.
4. Chỉ dùng anon key ở client khi policies đã được kiểm chứng; không đưa service role key vào frontend.

Scheduled notifications cần `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` và `TASKBOARD_OWNER_ID`; Vercel cron gọi `/api/notifications` mỗi giờ. Endpoint tạo candidates từ Supabase và có thể gửi Chatwork khi `CHATWORK_API_TOKEN` cùng `CHATWORK_ROOM_ID` được cấu hình; Gmail chưa được hỗ trợ.

Integration smoke test Supabase và cách cấu hình test project xem tại [docs/SUPABASE_SMOKE_TEST.md](docs/SUPABASE_SMOKE_TEST.md). Ma trận release và bằng chứng hiện tại xem tại [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md).

Xem [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Chatwork, Gmail và tệp đính kèm

Chatwork đã có nút gửi thông báo test qua server route; reminder định kỳ cần task remote và scheduler. Upload attachment chỉ hoạt động ở cloud mode sau khi đăng nhập Supabase và chạy đúng Storage policy; bucket dùng private object + signed URL, local mode chỉ lưu URL metadata. Gmail chưa triển khai. Token phải nằm ở server secrets, notification định kỳ cần scheduler và chống gửi trùng. Xem [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) và [docs/ROADMAP.md](docs/ROADMAP.md).

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
  data.ts            Demo data, migration và validation
  storage/           IndexedDB/localStorage persistence và attachment storage
  taskboard/         Selectors, constraints, permissions, search, sync queue
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
  NOTIFICATIONS.md   Browser reminder và Chatwork test
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
npm run test         # Chạy regression và edge-case tests
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
