# Backup JSON format

Export format v1:

```json
{
  "schema_version": 1,
  "exported_at": "ISO-8601 timestamp",
  "code_prefix": "MENSQZIN-",
  "sort_mode": "smart",
  "tasks": [
    {
      "id": "task-id",
      "title": "Example",
      "status": "todo",
      "priority": "medium",
      "severity": "medium",
      "description": "",
      "assignee_ids": ["member-id-1", "member-id-2"],
      "assignee_id": "member-id-1",
      "next_action": "Viết test cho luồng chính",
      "review_note": "",
      "blocked_by": [],
      "activity": []
    }
  ],
  "members": []
}
```

Import hiển thị preview gồm số task/thành viên trước khi người dùng xác nhận thay thế workspace local. Task IDs và member IDs được giữ nguyên để bảo toàn quan hệ. Backup không gồm secrets, session hoặc file binary. `links` là danh sách URL; attachment metadata có thể gồm `storage_path` khi file đến từ Supabase Storage private bucket.

Các field bổ sung tương thích ngược gồm `review` trong `status`, `checklist`, `inbox`, `snoozed_until` và `activity[].changes`. Backup v1/v2 vẫn được đọc; migration chỉ thêm default, không đổi task identity.

`assignee_ids` là field chuẩn, cho phép một task có một hoặc nhiều người phụ trách. `assignee_id` chỉ được giữ để tương thích với dữ liệu cũ; khi đọc dữ liệu legacy, ứng dụng tự chuyển nó thành mảng một phần tử. Ở database Supabase, quan hệ nhiều-nhiều nằm trong bảng `task_assignees`; cột `tasks.assignee_id` được giữ nullable trong giai đoạn chuyển đổi.

Task/member IDs trong Supabase dùng `text` thay vì UUID để dữ liệu legacy như `t1`/`m1` có thể đồng bộ mà không bị đổi identity. Các ID của user và workspace vẫn là UUID và tiếp tục được RLS bảo vệ.

Ở remote boundary, ID legacy được namespace theo owner (personal workspace) hoặc workspace (shared workspace) để tránh collision giữa user/workspace; khi Pull về local, namespace được loại bỏ và ID gốc được khôi phục.

Trong cloud workspace, mỗi `task_assignees` phải trỏ tới member có cùng `workspace_id` với task. Đây là invariant được kiểm tra bằng RLS và database trigger; dữ liệu legacy cùng có `workspace_id = null` vẫn được hỗ trợ.

`next_action`, `review_note`, `blocked_by` và `activity` là field tùy chọn để tương thích backup cũ. `blocked_by` chứa task ID và không được tạo vòng lặp; `activity` chỉ là history tóm tắt các thay đổi quan trọng, không phải audit log bảo mật.

Saved views và trạng thái undo được lưu riêng trong localStorage (`taskboard-saved-views-v1` và state runtime), không nằm trong JSON backup v1. Undo chỉ khôi phục thao tác gần nhất trong phiên hiện tại; export/import vẫn là cơ chế restore bền vững.

Ô tìm kiếm hỗ trợ điều kiện dạng `status:review`, `priority:urgent`, `due:today|overdue|week`, `inbox:true|false` kết hợp với text tự do. Điều kiện được parse ở selector dùng chung, không lưu text đã dịch vào domain data.
