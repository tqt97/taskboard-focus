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

- backup hợp lệ và normalize dữ liệu legacy;
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

`npm run test:e2e` chạy 21 matrix cases trên Chromium desktop/tablet/mobile, gồm modal, Inbox/checklist, persistence, workspace selector/template isolation và hamburger right drawer. Supabase Auth/Storage/realtime và Chatwork thật vẫn cần smoke test với credentials tương ứng; local CI không được xem là bằng chứng production delivery.

Integration smoke test Supabase nằm ở `tests/supabase.integration.test.mts`; chạy riêng bằng `npm run test:supabase`, hướng dẫn đầy đủ ở [SUPABASE_SMOKE_TEST.md](SUPABASE_SMOKE_TEST.md). Dùng `npm run test:supabase:required` trong CI/release để fail rõ ràng nếu thiếu URL, anon key hoặc ba tài khoản dedicated owner/member/viewer; không dùng tài khoản production vì test tạo rồi xóa một workspace riêng.
