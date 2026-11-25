# Taskboard release readiness

Ngày rà soát: 2026-11-25

Tài liệu này tách rõ phần đã có bằng chứng local/browser khỏi phần cần runtime Supabase thật. Không coi test bị `skip` là bằng chứng cloud đã hoàn tất.

## P0 — Hiệu suất sử dụng

| Hạng mục                     | Trạng thái                  | Bằng chứng                                     |
| ---------------------------- | --------------------------- | ---------------------------------------------- |
| Review và Blocked tách riêng | Đã kiểm chứng local         | `lib/types.ts`, selectors, Board; domain tests |
| Inbox + triage               | Đã kiểm chứng browser       | `/inbox`, E2E Inbox/checklist                  |
| Today action center          | Đã kiểm chứng local/browser | selectors, `/today`, E2E responsive            |
| Checklist/subtask            | Đã kiểm chứng local/browser | `TaskModal`, parser tests, E2E modal           |
| Quick actions                | Đã kiểm chứng local/browser | Board actions, E2E task flows                  |
| Activity diff                | Đã kiểm chứng local/browser | activity parser/domain tests, modal history    |

## P1 — Độ tin cậy

| Hạng mục                        | Trạng thái                      | Bằng chứng                                              |
| ------------------------------- | ------------------------------- | ------------------------------------------------------- |
| Import preview                  | Đã kiểm chứng local/browser     | Board preview confirmation, E2E modal flows             |
| Advanced search/saved views     | Đã kiểm chứng local/browser     | search tests, workspace-scoped saved views E2E          |
| Revision/conflict contract      | Đã kiểm chứng qua unit contract | repository/queue tests; Supabase race chưa chạy thật    |
| Signed URL/attachment lifecycle | Đã kiểm chứng code/browser      | private bucket policy, signed URL refresh, cleanup path |
| Quiet hours/retry/dedupe        | Đã kiểm chứng local             | notification tests and server route contract            |

## P2 — Scale và cộng tác

| Hạng mục                   | Trạng thái                              | Bằng chứng                                                                                         |
| -------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| IndexedDB + local fallback | Đã kiểm chứng local/browser             | storage tests, persistence E2E                                                                     |
| Remote CRUD từng task      | Contract đã triển khai                  | `RemoteTaskRepository`, queue tests                                                                |
| Quyền thành viên/RLS       | Schema + migration đã validate local    | `supabase/schema.sql` chạy được trên DB mới và DB legacy UUID; integration runtime chờ credentials |
| Multi-workspace            | Đã kiểm chứng local/browser             | workspace/task/template/view isolation E2E                                                         |
| Realtime collaboration     | Contract đã triển khai, runtime pending | task + assignee subscriptions; cần Supabase multi-client smoke test                                |

Trong rà soát 2026-11-25, quick capture, snapshot backup, daily reminder digest, lazy route chunks và IndexedDB-first async persistence đã được triển khai. Build hiện báo First Load JS workspace 203 kB, so với mốc 208 kB trước đợt tối ưu. Browser E2E chưa được thực thi vì máy thiếu Playwright Chromium; Supabase/Chatwork runtime vẫn cần credentials và dịch vụ thật.

## Required cloud gate

Chạy lệnh sau trong môi trường có Supabase test project và ba tài khoản dedicated owner/member/viewer:

```bash
npm run test:supabase:required
```

Lệnh sẽ fail rõ ràng nếu thiếu các biến `TASKBOARD_TEST_*`; không dùng tài khoản production. Chỉ sau khi lệnh này pass mới được kết luận RLS, remote CRUD, signed Storage và collaboration runtime đã đạt.

## Kết quả cục bộ của lần rà soát này

```text
npm run typecheck             pass
npm run test                  66 passed, 1 skipped (Supabase credentials absent)
npm run format:check          pass (repo formatting synchronized)
npm run build                 pass; First Load JS workspace 203 kB
npm run test:e2e              blocked: Chromium executable missing from Playwright cache
`npm audit --omit=dev`        pass; 0 vulnerabilities after PostCSS override
Supabase integration/runtime  not run: test credentials absent
```
