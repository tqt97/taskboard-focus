"use client";

import { useMemo } from "react";
import type { AppLocale, UiCopy } from "@/lib/i18n";
import type { Member, Task } from "@/lib/types";
import type { BoardNotification } from "../dialogs/NotificationPopover";

type ReminderItem = { task: Task; label: string; date: string };

export function useWorkspaceNotifications({
  tasks,
  members,
  reminders,
  cloudUserId,
  locale,
  copy,
  nowMs,
  readIds,
  dueText,
}: {
  tasks: Task[];
  members: Member[];
  reminders: ReminderItem[];
  cloudUserId: string;
  locale: AppLocale;
  copy: UiCopy;
  nowMs: number;
  readIds: string[];
  dueText: (value: string, copy: UiCopy) => string;
}) {
  return useMemo<BoardNotification[]>(() => {
    const milestoneNotifications = reminders.slice(0, 8).map((item) => {
      const id = `${item.task.id}-${item.label}`;
      return {
        id,
        taskId: item.task.id,
        title: `${item.label}: ${item.task.title}`,
        detail: `${item.task.code || "TASK"} · ${dueText(item.date, copy)}`,
        overdue: new Date(item.date).getTime() < nowMs,
        read: readIds.includes(id),
      };
    });
    const currentMemberId = members.find(
      (member) => member.user_id === cloudUserId || member.id === cloudUserId,
    )?.id;
    const mentionCopy = {
      vi: "Bạn được nhắc tên trong",
      en: "You were mentioned in",
      ja: "メンションされました",
    }[locale];
    const mentionNotifications = currentMemberId
      ? tasks.flatMap((task) =>
          (task.comments || [])
            .filter((comment) => comment.mention_ids?.includes(currentMemberId))
            .map((comment) => {
              const id = `mention-${task.id}-${comment.id}`;
              return {
                id,
                taskId: task.id,
                title: `${mentionCopy} ${task.code || "task"}`,
                detail: comment.body,
                overdue: false,
                read: readIds.includes(id),
              };
            }),
        )
      : [];
    return [...mentionNotifications, ...milestoneNotifications];
  }, [cloudUserId, copy, dueText, locale, members, nowMs, readIds, reminders, tasks]);
}
