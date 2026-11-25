"use client";

import { useEffect } from "react";
import type { Task } from "@/lib/types";
import { isWithinQuietHours } from "@/lib/taskboard/notifications";
import type { ReminderSettings } from "../WorkspaceDialogs";

const storageKey = "taskboard-browser-reminders-v1";
const milestoneFields = [
  ["Deadline", "deadline"],
  ["Dev up", "dev_up"],
  ["Staging up", "staging_up"],
  ["Release", "release_at"],
] as const;

export function useBrowserReminders({
  ready,
  enabled,
  permission,
  tasks,
  settings,
  nowMs,
  onDueText,
  onOpenTask,
}: {
  ready: boolean;
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
  tasks: Task[];
  settings: ReminderSettings;
  nowMs: number;
  onDueText: (value: string) => string;
  onOpenTask: (taskId: string) => void;
}) {
  useEffect(() => {
    if (!ready || !enabled || permission !== "granted") return;
    const now = new Date(nowMs);
    if (isWithinQuietHours(now, settings.quietHours.start, settings.quietHours.end))
      return;

    let sent: string[] = [];
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      sent = Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
    } catch {}
    const nextSent = [...sent];
    tasks.forEach((task) => {
      milestoneFields.forEach(([label, field]) => {
        const value = task[field];
        if (!value) return;
        const difference = new Date(value).getTime() - nowMs;
        if (difference < -86400000 || difference > settings.leadDays[label] * 86400000)
          return;
        const id = `${task.id}-${label}-${value.slice(0, 10)}`;
        if (nextSent.includes(id)) return;
        try {
          const notification = new Notification(`${label}: ${task.title}`, {
            body: `${task.code || "TASK"} · ${onDueText(value)}`,
            tag: id,
          });
          notification.onclick = () => {
            window.focus();
            onOpenTask(task.id);
            notification.close();
          };
          nextSent.push(id);
        } catch {
          return;
        }
      });
    });
    if (nextSent.length !== sent.length) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextSent.slice(-200)));
      } catch {}
    }
  }, [enabled, nowMs, onDueText, onOpenTask, permission, ready, settings, tasks]);
}
