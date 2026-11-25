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
  },
};

export function getUiCopy(locale: AppLocale): UiCopy {
  return copy[locale];
}
