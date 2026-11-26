# Next.js App Router: tổ chức thư mục và hiệu năng

Ngày khảo sát: 2026-11-26. Phạm vi nguồn: tài liệu Next.js/React chính thức và source local của Taskboard. “Convention” dưới đây là quy ước thực dụng, không phải API bắt buộc của framework.

## Kết luận ngắn

Taskboard đang đi đúng hướng cho một app local-first, client-heavy: route entry mỏng, feature code colocated dưới `app/_components/`, client boundary tách khỏi route, `dynamic(..., { ssr: false })` cho runtime phụ thuộc browser, và `loading.tsx`/`error.tsx` theo App Router. Trọng tâm tối ưu tiếp theo không phải ép dữ liệu local/IndexedDB vào Server Component hay thêm server cache, mà là giữ initial client bundle nhỏ, trì hoãn dialog/feature hiếm dùng, tránh render lại workspace state quá rộng, và đo bằng production build/browser trace.

## 1. Tổ chức thư mục

Next.js cho phép colocate file trong route segment; chỉ `page`/`route` làm segment public. Route groups `(group)` tổ chức code mà không đổi URL; private folders `_folder` loại khỏi routing; nên đặt shared code ngoài `app` hoặc trong thư mục feature có chủ đích. Xem [Project structure](https://nextjs.org/docs/app/getting-started/project-structure).

Áp dụng tại repo:

- `app/(workspace)/page.tsx`, `app/(workspace)/today/page.tsx` là entry mỏng; mỗi page trả controller tương ứng, còn UI workspace nằm ở `app/_components/workspace/`.
- `layout/`, `features/`, `dialogs/`, `hooks/`, `runtime/` phản ánh boundary theo feature/runtime, dễ tìm hơn một thư mục components phẳng (source: `app/_components/workspace/`).
- Route group `(workspace)` gom layout/loading/error mà không thêm segment vào URL. Đây là lý do thực tế để dùng route group, không phải để “làm đẹp” cây thư mục.
- `lib/` phù hợp cho domain, storage và repository dùng chung; không nên đẩy browser-only adapter vào Server Component import graph.

Không áp dụng máy móc: “mỗi component một folder” hoặc một kiến trúc `services/repositories/use-cases` lớn không được docs yêu cầu và có thể làm app UI nhỏ khó navigable. Tên thư mục không tạo được server/client boundary; boundary do module graph và directive quyết định.

## 2. Server/Client Components

Trong App Router, layout/page mặc định là Server Components; Client Component cần `'use client'` khi dùng state/effect/event handler/browser API. `'use client'` tạo boundary: các import phía dưới boundary đi vào client bundle, và props truyền qua boundary phải serializable. Xem [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components), [Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components), và [React Server Components](https://react.dev/reference/rsc/server-components).

Áp dụng:

- `app/layout.tsx` là server entry mỏng; `app/(workspace)/layout.tsx` là route-group entry; `WorkspaceLayout.tsx`, `WorkspaceEntry.tsx` và `WorkspaceRuntime.tsx` là client boundary cho shell/state runtime. Các page workspace vẫn là Server Components mặc định, giữ metadata/SEO và truyền content controller vào shell mà không dựng lại shell.
- Client-heavy là hợp lý vì state, event, `localStorage`, IndexedDB, browser reminders và realtime đều cần browser (source: `WorkspaceRuntime.tsx:57-65`, `lib/storage/indexed-db-board-storage.ts:30-47`, `lib/taskboard/use-board-sync.ts:51-61`).
- `ssr: false` có lý do ở coordinator/dialogs browser-dependent; không nên biến mọi presentational component thành client chỉ vì một ancestor đã là client.

Không áp dụng: server-side `fetch`/RSC cache làm nguồn dữ liệu chính cho workspace local-first. IndexedDB không tồn tại trên server; server cache cũng không thể đại diện cho state per-device và offline mutation. Nếu thêm route public, metadata hoặc server-only secret, giữ phần đó ở Server Component/Route Handler và truyền dữ liệu tối thiểu, serializable, vào client.

## 3. Dynamic imports và loading/error boundaries

Next khuyến nghị lazy-load component/library nặng hoặc hiếm dùng bằng `next/dynamic`; `ssr: false` chỉ dành cho component không thể render trên server. `loading` của dynamic import là fallback trong lúc chunk tải. Xem [Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading).

Repo đã dùng đúng seam cho WorkspaceLayout, WorkspaceProvider, sidebar/header, runtime, TaskModal, settings/confirm/lock, notification, import/conflict/template dialogs và TaskCard. Đây là phân chia theo lifecycle/interaction frequency, không chỉ theo file size.

`loading.tsx` tự tạo Suspense boundary cho segment và cho phép shell/streaming; `error.tsx` là Client Component error boundary, nhận `reset`. Xem [Loading UI and Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming) và [Error handling](https://nextjs.org/docs/app/getting-started/error-handling).

Áp dụng tại repo: `app/loading.tsx`, `app/(workspace)/loading.tsx` và `app/error.tsx` đã có; workspace loading/error tái sử dụng `WorkspaceRouteLoading` và `WorkspaceRouteError` (source: `app/(workspace)/loading.tsx`, `app/(workspace)/error.tsx`). Nên giữ fallback có cùng geometry để giảm layout shift. Error boundary không thay thế xử lý lỗi persistence/sync: các lỗi đó cần trạng thái domain và recovery/export UI.

## 4. Caching và parallel data fetching

Next App Router hỗ trợ cache/revalidate/tag cho dữ liệu server; React/Next cũng khuyến nghị tránh request waterfall bằng cách bắt đầu các promise độc lập sớm và `Promise.all` khi cần chờ song song. Xem [Caching](https://nextjs.org/docs/app/building-your-application/caching), [Fetching data](https://nextjs.org/docs/app/building-your-application/data-fetching), và [Preload pattern](https://nextjs.org/docs/app/building-your-application/data-fetching/patterns).

Phần áp dụng có giới hạn:

- Không nên cache chung response task/workspace ở server: dữ liệu là per-device/per-user, local-first và có optimistic/offline sync (source: `lib/storage/indexed-db-board-storage.ts:50-99`, `lib/taskboard/use-board-sync.ts:201-220`).
- Trong browser, có thể song song các đọc độc lập như IndexedDB workspace, locale và template; nhưng phải giữ thứ tự/queue của write (`writeQueue`) và không chạy song song các mutation có phụ thuộc revision.
- Khi cloud mode cần nhiều read độc lập, cân nhắc `Promise.all` trong client effect/service, kèm cancellation/stale-result guard; không dùng “parallel” để phá ordering của queue, conflict resolution hoặc realtime subscription.
- Caching HTTP của static assets/font vẫn hữu ích; đó là asset caching, khác với cache dữ liệu board.

## 5. Performance checklist phù hợp Taskboard

- Đo production build và browser trace trước/sau: First Load JS, chunk tải sau interaction, LCP/INP/CLS, thời gian hydrate và long task. Hướng dẫn tổng hợp: [Next.js Optimizing](https://nextjs.org/docs/app/building-your-application/optimizing) và [React `<Profiler>`](https://react.dev/reference/react/Profiler).
- Giữ `WorkspaceRuntime` không phình thêm; `WorkspaceProvider` là seam context cho feature content, còn sidebar/header đã tách khỏi runtime markup. Context vẫn gom derived data và callbacks nên cần đo rerender bằng React Profiler trước khi tách thêm persistence/mutations/permissions; không mặc định rewrite tiếp.
- Tiếp tục defer modal/dialog/feature hiếm dùng; chỉ lazy-load một list/card khi profiling cho thấy chi phí mount lớn. Lazy import tự nó không chứng minh performance tốt hơn.
- IndexedDB async là đúng hướng cho main-thread responsiveness, nhưng lọc/sort/memoization và số lượng task lớn vẫn cần benchmark thực tế. Không tuyên bố đạt performance budget nếu chưa có production trace.
- Dùng `useDeferredValue`/memoization có mục tiêu cho derived search/filter; tránh lạm dụng vì cache/memoization cũng có chi phí và không thay thế data-structure/virtualization phù hợp.

## Áp dụng / không áp dụng — quyết định cho repo này

| Guidance                                        | Áp dụng                                                  | Không nên áp dụng máy móc                                          |
| ----------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Colocation, private folders, thin route entries | Có; route group workspace giữ layout/loading/error chung | Chỉ thêm route group khi có layout hoặc lifecycle chung            |
| Server Components mặc định                      | Có cho shell, metadata, route entries                    | Không ép IndexedDB/local state/cloud realtime vào server           |
| Client boundary nhỏ                             | Có; giữ browser/runtime code sau boundary                | Không rải `'use client'` lên toàn bộ `app`                         |
| Dynamic import                                  | Có cho coordinator và interaction hiếm dùng              | Không lazy-load mọi component nhỏ                                  |
| `loading.tsx`/`error.tsx`                       | Có; giữ skeleton geometry và recovery UI                 | Không coi boundary là xử lý được mọi lỗi sync/domain               |
| Server cache/revalidate                         | Chỉ cho public/static/server-owned data                  | Không cache board per-device như dữ liệu dùng chung                |
| Parallel fetch                                  | Có cho cloud reads độc lập                               | Không song song write queue/revision/conflict operations           |
| Performance optimization                        | Đo bundle, hydration, rerender, long task                | Không kết luận từ static inspection hoặc một con số build duy nhất |

## Evidence và giới hạn

- Evidence local là static source inspection; chưa chạy browser, production trace, bundle analyzer, large-dataset benchmark, Supabase/network A/B hoặc đo cache hit/miss trong report này.
- `package.json` hiện dùng Next `^15.5.3` và React `^19.1.1`; URL docs ở trên là tài liệu chính thức hiện hành và có thể thay đổi nội dung theo version. Nên đối chiếu version-specific docs trước khi nâng dependency.
- Trong phiên này, truy cập mạng tới `nextjs.org`/`react.dev` qua web và `curl` bị lỗi DNS/response decoding; vì vậy report cung cấp direct links và tổng hợp guidance theo tài liệu chính thức đã biết, nhưng không claim đã live-read từng trang tại thời điểm tạo file.
