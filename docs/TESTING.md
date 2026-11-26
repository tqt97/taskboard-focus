# Testing

## Lệnh chuẩn

```bash
npm run test
npm run test:e2e
npm run test:supabase
npm run test:supabase:required
npm run check
```

`npm run test` dùng Node.js test runner native, không thêm dependency runtime. Bộ test hiện khóa các edge case của backup/domain parser:

CI chạy `npm run test` cùng format check, typecheck và production build trước khi deploy. `npm run check` chạy lần lượt typecheck, unit tests, format check và build.

- backup hợp lệ và normalize dữ liệu legacy;
- nhập backup legacy không có `schema_version`, lỗi JSON/schema và undo sau khi thay workspace nhầm;
- JSON root sai, duplicate member/task ID;
- member sai shape, title rỗng và timestamp/activity rỗng;
- assignee legacy/multi-assignee không tồn tại;
- dependency hợp lệ, thiếu task, tự phụ thuộc, cycle 2 nút và cycle 3 nút;
- date không hợp lệ, link legacy/primary không an toàn;
- task title vượt giới hạn, payload vượt giới hạn số lượng;
- sort mode không được hỗ trợ được fallback về `smart`.
- migration defaults cho schema v2, Today/archive selector, dependency readiness, recurrence và template provenance.
- schema version không hỗ trợ, duplicate assignee/dependency relation và monthly recurrence cuối tháng.
- locale normalization, Intl mapping và fallback về Tiếng Việt khi gặp locale không hỗ trợ.
- workspace permission boundary (`owner/admin/member/viewer`), remote queue dedupe theo workspace/task và account isolation khi nhiều user dùng cùng browser.
- Web Push: cấu hình thiếu/sai, dedupe theo trạng thái run, gửi qua adapter giả lập, retry khi lỗi tạm thời và xóa subscription hết hạn 404/410.
- Inline edit title kiểm tra validation/activity; compiled search matcher được đối chiếu với API matcher tiện ích.
- `npm run benchmark` so sánh matcher query ở 100/1.000/10.000 task; `npm run benchmark:e2e` đo hydration dataset, tìm kiếm, mở TaskModal và tab lịch sử trên browser desktop.

`npm run test:e2e` chạy Playwright trên Chromium desktop/tablet/mobile, gồm responsive layout, modal, Draft/checklist, persistence, workspace selector/template isolation, navigation drawer, persistent workspace shell khi đổi route, quick capture shortcut, inline title edit và saved view removal. Browser tests cần Chromium đã cài (`npx playwright install chromium`). Số test có thể thay đổi; dùng output lần chạy hiện tại làm kết quả chuẩn. Supabase Auth/Storage/realtime và Web Push thật vẫn cần smoke test với credentials tương ứng; local CI không được xem là bằng chứng production delivery.

Integration smoke test Supabase nằm ở `tests/supabase.integration.test.mts`; chạy riêng bằng `npm run test:supabase`, hướng dẫn đầy đủ ở [SUPABASE_SMOKE_TEST.md](SUPABASE_SMOKE_TEST.md). Dùng `npm run test:supabase:required` trong CI/release để fail rõ ràng nếu thiếu URL, anon key hoặc ba tài khoản dedicated owner/member/viewer; không dùng tài khoản production vì test tạo rồi xóa một workspace riêng.
