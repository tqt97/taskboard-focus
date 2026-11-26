import type { Task } from "../types";
import { isDueToday, isOverdue } from "./selectors.ts";

type QueryFilters = {
  status?: string;
  priority?: string;
  due?: string;
  draft?: boolean;
};

const tokenPattern = /(^|\s)(status|priority|due|draft):([^\s]+)/gi;

export const parseTaskSearch = (query: string) => {
  const filters: QueryFilters = {};
  const normalized = query.replace(
    tokenPattern,
    (_, prefix: string, key: string, value: string) => {
      const normalizedValue = value.toLowerCase();
      if (key.toLowerCase() === "status") filters.status = normalizedValue;
      if (key.toLowerCase() === "priority") filters.priority = normalizedValue;
      if (key.toLowerCase() === "due") filters.due = normalizedValue;
      if (key.toLowerCase() === "draft") filters.draft = normalizedValue === "true";
      return prefix;
    },
  );
  return { filters, text: normalized.replace(/\s+/g, " ").trim().toLowerCase() };
};

export const createTaskSearchMatcher = (query: string, now = new Date()) => {
  const { filters, text } = parseTaskSearch(query);
  return (task: Task) => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.draft !== undefined && task.is_draft !== filters.draft) return false;
    if (filters.due === "today" && !isDueToday(task, now)) return false;
    if (filters.due === "overdue" && !isOverdue(task, now)) return false;
    if (
      filters.due === "week" &&
      (!task.deadline ||
        new Date(task.deadline).getTime() < now.getTime() ||
        new Date(task.deadline).getTime() > now.getTime() + 7 * 86400000)
    )
      return false;
    if (!text) return true;
    return `${task.code} ${task.title} ${task.description} ${task.next_action || ""}`
      .toLowerCase()
      .includes(text);
  };
};

export const matchesTaskSearch = (task: Task, query: string, now = new Date()) =>
  createTaskSearchMatcher(query, now)(task);
