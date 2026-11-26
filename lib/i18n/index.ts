export const supportedLocales = ["vi", "en", "ja"] as const;
export type AppLocale = (typeof supportedLocales)[number];

export const localeLabels: Record<AppLocale, string> = {
  vi: "Tiếng Việt",
  en: "English",
  ja: "日本語",
};

export const intlLocale: Record<AppLocale, string> = {
  vi: "vi-VN",
  en: "en-US",
  ja: "ja-JP",
};

const localeStorageKey = "taskboard-locale-v1";

export function normalizeLocale(value: unknown): AppLocale {
  return typeof value === "string" && supportedLocales.includes(value as AppLocale)
    ? (value as AppLocale)
    : "vi";
}

export function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return "vi";
  try {
    return normalizeLocale(window.localStorage.getItem(localeStorageKey));
  } catch {
    return "vi";
  }
}

export function writeStoredLocale(locale: AppLocale): boolean {
  try {
    window.localStorage.setItem(localeStorageKey, locale);
    return true;
  } catch {
    return false;
  }
}

export type UiCopy = {
  greeting: { morning: string; afternoon: string; evening: string };
  due: {
    unset: string;
    today: string;
    overdue: (days: number) => string;
    remaining: (days: number) => string;
  };
  status: Record<"todo" | "in_progress" | "review" | "blocked" | "done", string>;
  priority: Record<"urgent" | "high" | "medium" | "low", string>;
  overview: {
    nextAction: string;
    progress: string;
    today: string;
    todayFoot: string;
    review: string;
    reviewFoot: string;
    blocked: string;
    blockedFoot: string;
    done: string;
    doneFoot: (done: number, total: number) => string;
    reviewLane: string;
    reviewLaneDescription: string;
    blockedLane: string;
    blockedLaneDescription: string;
    overdueLane: string;
    overdueLaneDescription: string;
    emptyLane: string;
    noWorkTitle: string;
    noWorkDescription: string;
    browseTasks: string;
    details: string;
    flowTitle: string;
    flowDescription: string;
    activityTitle: string;
    activityDescription: string;
    activityTotal: (count: number) => string;
    peakDay: (count: number) => string;
    teamTitle: string;
    teamDescription: string;
    noOpenByMember: string;
    action: {
      start: string;
      review: string;
      complete: string;
      unblock: string;
      resolveDependency: string;
      followDependency: string;
      continue: string;
      blockedReason: string;
      reviewReason: string;
      overdueReason: string;
      todoReason: string;
      inProgressReason: string;
      dependencyReason: string;
    };
  };
};

const copy: Record<AppLocale, UiCopy> = {
  vi: {
    greeting: {
      morning: "Chào buổi sáng",
      afternoon: "Chào buổi chiều",
      evening: "Chào buổi tối",
    },
    due: {
      unset: "Chưa đặt",
      today: "Hôm nay",
      overdue: (days) => `Quá hạn ${days} ngày`,
      remaining: (days) => `Còn ${days} ngày`,
    },
    status: {
      todo: "Chưa làm",
      in_progress: "Đang làm",
      review: "Chờ review",
      blocked: "Bị chặn",
      done: "Hoàn tất",
    },
    priority: { urgent: "Khẩn cấp", high: "Cao", medium: "Vừa", low: "Thấp" },
    overview: {
      nextAction: "Việc nên làm tiếp theo",
      progress: "Tiến độ hoàn tất",
      today: "Hôm nay",
      todayFoot: "quá hạn, đến hạn hoặc khẩn",
      review: "Chờ review",
      reviewFoot: "cần quyết định tiếp theo",
      blocked: "Bị chặn",
      blockedFoot: "cần gỡ vướng hoặc dependency",
      done: "Đã hoàn tất",
      doneFoot: (done, total) => `trên ${total} công việc`,
      reviewLane: "Review cần quyết định",
      reviewLaneDescription: "Task đã sẵn sàng để kiểm tra",
      blockedLane: "Đang bị chặn",
      blockedLaneDescription: "Ưu tiên gỡ dependency hoặc vướng mắc",
      overdueLane: "Quá hạn",
      overdueLaneDescription: "Task cần xử lý hoặc cập nhật deadline",
      emptyLane: "Không có task trong nhóm này.",
      noWorkTitle: "Workspace đang trống việc cần xử lý",
      noWorkDescription: "Xem lại danh sách task để tiếp tục công việc.",
      browseTasks: "Mở danh sách task",
      details: "Xem chi tiết",
      flowTitle: "Luồng công việc",
      flowDescription: "Phân bổ task đang hoạt động theo trạng thái",
      activityTitle: "Nhịp tạo task",
      activityDescription: "Tham khảo hoạt động 14 ngày gần nhất",
      activityTotal: (count) => `${count} task mới trong 14 ngày`,
      peakDay: (count) => `Ngày cao nhất: ${count}`,
      teamTitle: "Tải công việc",
      teamDescription: "Task đang mở theo người phụ trách",
      noOpenByMember: "Chưa có task đang mở theo người.",
      action: {
        start: "Bắt đầu task",
        review: "Review task",
        complete: "Hoàn tất task",
        unblock: "Gỡ chặn",
        resolveDependency: "Gỡ dependency",
        followDependency: "Theo dõi dependency",
        continue: "Tiếp tục task",
        blockedReason: "Task đang bị chặn",
        reviewReason: "Task đã sẵn sàng để kiểm tra",
        overdueReason: "Task đã quá deadline",
        todoReason: "Task chưa được thực hiện",
        inProgressReason: "Task đang được thực hiện",
        dependencyReason: "Đang chờ task phụ thuộc hoàn tất",
      },
    },
  },
  en: {
    greeting: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
    },
    due: {
      unset: "Not set",
      today: "Today",
      overdue: (days) => `${days} day${days === 1 ? "" : "s"} overdue`,
      remaining: (days) => `${days} day${days === 1 ? "" : "s"} left`,
    },
    status: {
      todo: "To do",
      in_progress: "In progress",
      review: "Awaiting review",
      blocked: "Blocked",
      done: "Done",
    },
    priority: { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" },
    overview: {
      nextAction: "Next action",
      progress: "Completion progress",
      today: "Today",
      todayFoot: "overdue, due today or urgent",
      review: "Awaiting review",
      reviewFoot: "need a decision",
      blocked: "Blocked",
      blockedFoot: "need an unblock or dependency fix",
      done: "Completed",
      doneFoot: (done, total) => `of ${total} tasks`,
      reviewLane: "Review decisions",
      reviewLaneDescription: "Tasks ready to be checked",
      blockedLane: "Blocked work",
      blockedLaneDescription: "Resolve a dependency or blocker",
      overdueLane: "Overdue",
      overdueLaneDescription: "Handle the task or update its deadline",
      emptyLane: "No tasks in this group.",
      noWorkTitle: "Nothing needs attention right now",
      noWorkDescription: "Open the task list to continue working.",
      browseTasks: "Open task list",
      details: "View details",
      flowTitle: "Work flow",
      flowDescription: "Active tasks by status",
      activityTitle: "Task activity",
      activityDescription: "Tasks created in the last 14 days",
      activityTotal: (count) => `${count} new tasks in 14 days`,
      peakDay: (count) => `Peak day: ${count}`,
      teamTitle: "Workload",
      teamDescription: "Open tasks by assignee",
      noOpenByMember: "No open tasks by member.",
      action: {
        start: "Start task",
        review: "Review task",
        complete: "Complete task",
        unblock: "Unblock",
        resolveDependency: "Resolve dependency",
        followDependency: "Follow dependency",
        continue: "Continue task",
        blockedReason: "Task is blocked",
        reviewReason: "Task is ready for review",
        overdueReason: "Task is past its deadline",
        todoReason: "Task has not started",
        inProgressReason: "Task is in progress",
        dependencyReason: "Waiting for a dependency to finish",
      },
    },
  },
  ja: {
    greeting: {
      morning: "おはようございます",
      afternoon: "こんにちは",
      evening: "こんばんは",
    },
    due: {
      unset: "未設定",
      today: "今日",
      overdue: (days) => `${days}日超過`,
      remaining: (days) => `あと${days}日`,
    },
    status: {
      todo: "未着手",
      in_progress: "進行中",
      review: "レビュー待ち",
      blocked: "ブロック中",
      done: "完了",
    },
    priority: { urgent: "緊急", high: "高", medium: "中", low: "低" },
    overview: {
      nextAction: "次にやること",
      progress: "完了の進捗",
      today: "今日",
      todayFoot: "期限超過・今日が期限・緊急",
      review: "レビュー待ち",
      reviewFoot: "判断が必要",
      blocked: "ブロック中",
      blockedFoot: "ブロックや依存関係を解消",
      done: "完了",
      doneFoot: (done, total) => `${total}件中`,
      reviewLane: "レビューの判断",
      reviewLaneDescription: "確認できる状態のタスク",
      blockedLane: "ブロック中の作業",
      blockedLaneDescription: "依存関係や問題を解消",
      overdueLane: "期限超過",
      overdueLaneDescription: "対応するか期限を更新",
      emptyLane: "このグループにタスクはありません。",
      noWorkTitle: "今すぐ対応するタスクはありません",
      noWorkDescription: "タスク一覧を開いて作業を続けます。",
      browseTasks: "タスク一覧を開く",
      details: "詳細を見る",
      flowTitle: "作業フロー",
      flowDescription: "進行中タスクのステータス別内訳",
      activityTitle: "タスク作成状況",
      activityDescription: "過去14日間に作成されたタスク",
      activityTotal: (count) => `過去14日間に${count}件作成`,
      peakDay: (count) => `最多: ${count}`,
      teamTitle: "作業量",
      teamDescription: "担当者ごとの未完了タスク",
      noOpenByMember: "担当者ごとの未完了タスクはありません。",
      action: {
        start: "タスクを開始",
        review: "タスクをレビュー",
        complete: "タスクを完了",
        unblock: "ブロックを解除",
        resolveDependency: "依存関係を解消",
        followDependency: "依存タスクを確認",
        continue: "タスクを続ける",
        blockedReason: "タスクがブロックされています",
        reviewReason: "レビューできる状態です",
        overdueReason: "期限を過ぎています",
        todoReason: "まだ開始されていません",
        inProgressReason: "作業中のタスクです",
        dependencyReason: "依存タスクの完了を待っています",
      },
    },
  },
};

export function getUiCopy(locale: AppLocale): UiCopy {
  return copy[locale];
}
