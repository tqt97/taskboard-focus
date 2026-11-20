# Testing

## Lệnh chuẩn

```bash
npm run test
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

UI/browser, Supabase instance và Chatwork thật vẫn cần smoke test ở môi trường tương ứng; `npm run check` chỉ xác nhận typecheck, test domain, format và production build.
