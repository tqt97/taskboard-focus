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

Trong cập nhật 2026-11-25, quick capture, snapshot backup, daily reminder digest và lazy route chunks đã được triển khai; typecheck/build pass, browser E2E và Chatwork/Supabase runtime chưa chạy. Build report First Load JS workspace giảm từ 208 kB xuống 202 kB.

## Required cloud gate

Chạy lệnh sau trong môi trường có Supabase test project và ba tài khoản dedicated owner/member/viewer:

```bash
npm run test:supabase:required
```

Lệnh sẽ fail rõ ràng nếu thiếu các biến `TASKBOARD_TEST_*`; không dùng tài khoản production. Chỉ sau khi lệnh này pass mới được kết luận RLS, remote CRUD, signed Storage và collaboration runtime đã đạt.

## Local gates đã chạy

```text
npm run check                 pass
npm run test                  53 passed, 1 skipped (Supabase integration credentials absent)
npm run test:e2e              19 passed, 2 skipped (mobile workspace tests)
npm run test:supabase         1 skipped khi thiếu credentials
npm run test:supabase:required fail-fast khi thiếu credentials
schema validation             pass trên DB tạm mới + DB legacy UUID
```
