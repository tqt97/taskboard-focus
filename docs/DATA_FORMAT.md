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
      "assignee_ids": ["member-id-1", "member-id-2"],
      "assignee_id": "member-id-1"
    }
  ],
  "members": []
}
```

Import hiện thay thế workspace local. Task IDs và member IDs được giữ nguyên để bảo toàn quan hệ. Backup không gồm secrets, session hoặc file binary. `links` là danh sách URL; attachment metadata chưa hỗ trợ.

`assignee_ids` là field chuẩn, cho phép một task có một hoặc nhiều người phụ trách. `assignee_id` chỉ được giữ để tương thích với dữ liệu cũ; khi đọc dữ liệu legacy, ứng dụng tự chuyển nó thành mảng một phần tử. Ở database Supabase, quan hệ nhiều-nhiều nằm trong bảng `task_assignees`; cột `tasks.assignee_id` được giữ nullable trong giai đoạn chuyển đổi.
