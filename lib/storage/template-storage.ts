import type { TaskTemplate } from "../types";

const key = "taskboard-templates-v1";

export interface TemplateStorage {
  load(): TaskTemplate[];
  save(templates: TaskTemplate[]): boolean;
}

export const localTemplateStorage: TemplateStorage = {
  load() {
    if (typeof window === "undefined") return [];
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? (parsed as TaskTemplate[]).slice(-50) : [];
    } catch {
      return [];
    }
  },
  save(templates) {
    try {
      window.localStorage.setItem(key, JSON.stringify(templates.slice(-50)));
      return true;
    } catch {
      return false;
    }
  },
};
