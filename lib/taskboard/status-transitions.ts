import type { Status, Task } from "../types";

export type BlockedReturnStatus = "todo" | "in_progress" | "review";

const statusLabels: Record<Status, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  review: "Chờ review",
  blocked: "Bị chặn",
  done: "Hoàn tất",
};

export type StatusTransition = {
  allowed: boolean;
  target: Status;
  blocked_from?: BlockedReturnStatus;
  summary: string;
  warning?: string;
};

const isBlockedReturnStatus = (
  status: Status | undefined,
): status is BlockedReturnStatus =>
  status === "todo" || status === "in_progress" || status === "review";

export function getBlockedReturnStatus(
  task: Pick<Task, "blocked_from">,
): BlockedReturnStatus {
  return isBlockedReturnStatus(task.blocked_from) ? task.blocked_from : "in_progress";
}

export function getPrimaryStatusAction(task: Pick<Task, "status" | "blocked_from">) {
  switch (task.status) {
    case "todo":
      return {
        target: "in_progress" as const,
        label: "Bắt đầu",
        title: "Bắt đầu task",
      };
    case "in_progress":
      return {
        target: "review" as const,
        label: "Gửi review",
        title: "Chuyển task sang Chờ review để được kiểm tra",
      };
    case "review":
      return {
        target: "done" as const,
        label: "Hoàn tất",
        title: "Duyệt review và đánh dấu task hoàn tất",
      };
    case "blocked":
      return {
        target: getBlockedReturnStatus(task),
        label: "Gỡ chặn",
        title: "Gỡ chặn và quay lại trạng thái trước đó",
      };
    case "done":
      return {
        target: "in_progress" as const,
        label: "Mở lại",
        title: "Mở lại task để thực hiện thêm thay đổi",
      };
  }
}

export function resolveStatusTransition(
  from: Status,
  to: Status,
  blockedFrom?: BlockedReturnStatus,
): StatusTransition {
  if (from === to) {
    return {
      allowed: true,
      target: to,
      ...(to === "blocked"
        ? { blocked_from: getBlockedReturnStatus({ blocked_from: blockedFrom }) }
        : {}),
      summary: `Giữ trạng thái ${statusLabels[to]}`,
    };
  }

  if (to === "blocked" && from !== "done") {
    return {
      allowed: true,
      target: to,
      blocked_from: isBlockedReturnStatus(from) ? from : "in_progress",
      summary: `Đã chuyển task sang Bị chặn; khi gỡ chặn sẽ quay lại ${statusLabels[isBlockedReturnStatus(from) ? from : "in_progress"]}.`,
    };
  }

  if (from === "blocked") {
    const returnStatus = getBlockedReturnStatus({ blocked_from: blockedFrom });
    if (to === returnStatus) {
      return {
        allowed: true,
        target: to,
        summary: `Đã gỡ chặn; task quay lại ${statusLabels[to]}.`,
      };
    }
    return {
      allowed: false,
      target: to,
      summary: "Không thể chuyển trạng thái",
      warning: `Task đang bị chặn. Hãy gỡ chặn để quay lại ${statusLabels[returnStatus]} trước khi chuyển sang trạng thái khác.`,
    };
  }

  const allowed =
    (from === "todo" && to === "in_progress") ||
    (from === "in_progress" && (to === "review" || to === "todo")) ||
    (from === "review" && (to === "done" || to === "in_progress")) ||
    (from === "done" && to === "in_progress");
  if (allowed) {
    return {
      allowed: true,
      target: to,
      summary:
        from === "in_progress" && to === "review"
          ? "Đã gửi task chờ review."
          : from === "review" && to === "done"
            ? "Đã duyệt review và hoàn tất task."
            : `Đã chuyển task sang ${statusLabels[to]}.`,
    };
  }

  const warning =
    to === "done"
      ? `Không thể hoàn tất trực tiếp từ ${statusLabels[from]}. Hãy chuyển sang Chờ review trước, sau đó mới duyệt hoàn tất.`
      : `Không thể chuyển trực tiếp từ ${statusLabels[from]} sang ${statusLabels[to]}. Hãy đi theo flow: Chưa làm → Đang làm → Chờ review → Hoàn tất.`;
  return {
    allowed: false,
    target: to,
    summary: "Không thể chuyển trạng thái",
    warning,
  };
}
