import type { TaskActivity } from "@/lib/types";
import type { AppLocale } from "@/lib/i18n";
import { formatActivityDate, formatActivityValue } from "@/lib/taskboard/activity";

export function TaskHistoryPanel({
  activity = [],
  locale,
}: {
  activity?: TaskActivity[];
  locale: AppLocale;
}) {
  return (
    <section className="task-history-panel" id="task-history-panel" role="tabpanel">
      <div className="form-block-heading">
        <div>
          <h3>Lịch sử thay đổi</h3>
          <p>Các cập nhật gần nhất của task, sắp xếp từ mới đến cũ.</p>
        </div>
      </div>
      {activity.length ? (
        <div className="task-activity-list">
          {activity
            .slice()
            .reverse()
            .map((item) => (
              <div className="task-activity-row" key={item.id}>
                <span>
                  <b>{item.summary}</b>
                  {item.changes?.length ? (
                    <small className="task-activity-changes">
                      {item.changes
                        .slice(0, 3)
                        .map(
                          (change) =>
                            `${change.field}: ${formatActivityValue(change.field, change.from, locale)} → ${formatActivityValue(change.field, change.to, locale)}`,
                        )
                        .join(" · ")}
                    </small>
                  ) : null}
                </span>
                <small>{formatActivityDate(item.at, locale)}</small>
              </div>
            ))}
        </div>
      ) : (
        <div className="history-empty">
          <b>Chưa có lịch sử thay đổi</b>
          <small>Các cập nhật sẽ xuất hiện ở đây sau khi task được lưu.</small>
        </div>
      )}
    </section>
  );
}
