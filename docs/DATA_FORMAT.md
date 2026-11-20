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

Import hiện thay thế workspace local. Task IDs và member IDs được giữ nguyên để bảo toàn quan hệ. Backup không gồm secrets, session hoặc file binary. `links` là danh sách URL; attachment metadata chưa hỗ trợ.

`assignee_ids` là field chuẩn, cho phép một task có một hoặc nhiều người phụ trách. `assignee_id` chỉ được giữ để tương thích với dữ liệu cũ; khi đọc dữ liệu legacy, ứng dụng tự chuyển nó thành mảng một phần tử. Ở database Supabase, quan hệ nhiều-nhiều nằm trong bảng `task_assignees`; cột `tasks.assignee_id` được giữ nullable trong giai đoạn chuyển đổi.

`next_action`, `review_note`, `blocked_by` và `activity` là field tùy chọn để tương thích backup cũ. `blocked_by` chứa task ID và không được tạo vòng lặp; `activity` chỉ là history tóm tắt các thay đổi quan trọng, không phải audit log bảo mật.

Saved views và trạng thái undo được lưu riêng trong localStorage (`taskboard-saved-views-v1` và state runtime), không nằm trong JSON backup v1. Undo chỉ khôi phục thao tác gần nhất trong phiên hiện tại; export/import vẫn là cơ chế restore bền vững.
