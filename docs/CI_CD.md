# CI/CD và deploy Vercel

Repository dùng GitHub Actions để kiểm tra code và deploy production lên Vercel.

## Luồng tự động

```text
Pull request -> format check -> typecheck -> production build

Push master -> format check -> typecheck -> production build -> Vercel production deploy
```

Workflow nằm ở `.github/workflows/ci-cd.yml`.

- Pull request vào `master`: chỉ chạy job `validate`.
- Push vào `master`: chạy `validate`, sau đó mới chạy `deploy`.
- Nếu validation fail, Vercel không được deploy.
- Các job cùng branch được gom bằng concurrency; run cũ bị hủy khi có push mới hơn.
- Workflow dùng Node.js 20 và `npm ci` theo `package-lock.json`.

## Tạo Vercel project

1. Đăng nhập Vercel và tạo/import project từ repository.
2. Chọn framework preset `Next.js`.
3. Giữ Build Command mặc định hoặc dùng `npm run build`.
4. Chọn Production Branch là `master`.
5. Không cần environment variable để chạy bản local-first hiện tại.

Nếu đã bật Vercel Git Integration tự động deploy, nên tắt Production Deployments của Vercel Git Integration để tránh deploy hai lần. Khi giữ Git Integration, có thể bỏ job `deploy` trong workflow và chỉ dùng GitHub Actions cho CI.

## Lấy Vercel secrets

Có thể lấy các giá trị bằng Vercel CLI:

```bash
npm install --global vercel@latest
vercel login
vercel link
```

Sau khi link project, file `.vercel/project.json` local chứa `projectId` và `orgId`. Không commit file này nếu project chưa có policy rõ ràng; dùng các giá trị đó để tạo GitHub Actions secrets.

Tạo secrets tại:

`GitHub repository → Settings → Secrets and variables → Actions → New repository secret`

| Secret              | Giá trị                                  |
| ------------------- | ---------------------------------------- |
| `VERCEL_TOKEN`      | Personal Access Token của Vercel         |
| `VERCEL_ORG_ID`     | `orgId` trong `.vercel/project.json`     |
| `VERCEL_PROJECT_ID` | `projectId` trong `.vercel/project.json` |

Không đặt token trong `.env`, source code, workflow literal hoặc log. `VERCEL_TOKEN` chỉ được truyền qua GitHub Secrets.

## Kiểm tra lần đầu

Sau khi tạo đủ secrets:

```bash
git add .
git commit -m "ci: add GitHub Actions Vercel deployment"
git push origin master
```

Theo dõi tại `GitHub → Actions → CI and Vercel deploy`.

Kết quả mong đợi:

1. `Validate application` pass format, typecheck và build.
2. `Deploy production to Vercel` được chạy sau validation.
3. Vercel tạo deployment production từ artifact đã build.

## Chẩn đoán lỗi

### `npm ci` fail

- Kiểm tra `package-lock.json` đã được commit cùng `package.json`.
- Dùng đúng Node.js 20.9+ local để tái hiện.
- Chạy `npm ci` sạch trước khi push.

### Vercel báo thiếu project hoặc organization

- Kiểm tra chính tả của `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID`.
- Đảm bảo token có quyền truy cập project.
- Chạy lại `vercel link` trong đúng project local.

### Validation pass nhưng deploy fail

- Mở log của riêng job `Deploy production to Vercel`.
- Kiểm tra token chưa expired/revoked.
- Kiểm tra Vercel project vẫn dùng đúng Production Branch.

### Muốn deploy branch khác

Đổi branch trong phần `on.push.branches` và điều kiện `github.ref` của job `deploy`. Chỉ nên deploy production từ một protected branch.

## Bảo vệ production

Nên bật branch protection cho `master` và yêu cầu job `Validate application` pass trước khi merge. Có thể tạo GitHub Environment tên `production` và bật required reviewers nếu muốn approval thủ công trước deploy.
