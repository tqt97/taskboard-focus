export type WorkspaceView = "overview" | "tasks" | "today" | "inbox" | "timeline";

export function WorkspacePageHeading({
  view,
  greeting,
  displayName,
}: {
  view: WorkspaceView;
  greeting: string;
  displayName: string;
}) {
  const title =
    view === "overview" ? (
      <>
        {greeting}, <span className="display-name">{displayName}</span>
      </>
    ) : view === "today" ? (
      "Hôm nay"
    ) : view === "inbox" ? (
      "Inbox cần triage"
    ) : view === "timeline" ? (
      "Lịch & timeline"
    ) : (
      "Danh sách task"
    );
  const description =
    view === "overview"
      ? "Một cái nhìn nhanh về tiến độ, rủi ro và các mốc sắp tới."
      : view === "today"
        ? "Các việc quá hạn, đến hạn hôm nay và ưu tiên khẩn cần được xử lý trước."
        : view === "inbox"
          ? "Các task mới cần được phân loại, giao người và đặt bước tiếp theo."
          : view === "timeline"
            ? "Nhìn toàn bộ mốc Dev, Staging, Release và Deadline trên trục thời gian."
            : "Tìm, lọc, tạo và cập nhật mọi task trong workspace.";

  return (
    <div>
      <h1>
        {title} <span aria-hidden="true">✦</span>
      </h1>
      <p>{description}</p>
    </div>
  );
}
