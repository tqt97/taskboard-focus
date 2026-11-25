import type { TaskTemplate } from "../types";

const key = "taskboard-templates-v1";
const storageKey = (workspaceId: string) => `${key}:${workspaceId}`;

export interface TemplateStorage {
  load(workspaceId?: string): TaskTemplate[];
  save(templates: TaskTemplate[], workspaceId?: string): boolean;
}

export const localTemplateStorage: TemplateStorage = {
  load(workspaceId = "default") {
    if (typeof window === "undefined") return [];
    try {
      const scoped = window.localStorage.getItem(storageKey(workspaceId));
      const legacy =
        workspaceId === "default" ? window.localStorage.getItem(key) : null;
      const parsed: unknown = JSON.parse(scoped || legacy || "[]");
      const templates = Array.isArray(parsed)
        ? (parsed as TaskTemplate[]).slice(-50)
        : [];
      if (!scoped && legacy)
        window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(templates));
      return templates;
    } catch {
      return [];
    }
  },
  save(templates, workspaceId = "default") {
    try {
      window.localStorage.setItem(
        storageKey(workspaceId),
        JSON.stringify(templates.slice(-50)),
      );
      return true;
    } catch {
      return false;
    }
  },
};
