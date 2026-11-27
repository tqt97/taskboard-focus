import { useEffect, useState } from "react";
import type { SavedView } from "@/lib/types";

const savedViewsKey = "taskboard-saved-views-v1";
const savedViewsStorageKey = (workspaceId: string) => `${savedViewsKey}:${workspaceId}`;

export function persistSavedViews(workspaceId: string, views: SavedView[]) {
  try {
    localStorage.setItem(savedViewsStorageKey(workspaceId), JSON.stringify(views));
    return true;
  } catch {
    return false;
  }
}

export function useSavedViews(workspaceId: string, ready: boolean) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => {
    if (!ready) return;
    try {
      const scopedKey = savedViewsStorageKey(workspaceId);
      const stored = localStorage.getItem(scopedKey);
      const legacy =
        workspaceId === "default" ? localStorage.getItem(savedViewsKey) : null;
      const storedViews = JSON.parse(stored || legacy || "[]");
      const validViews = Array.isArray(storedViews)
        ? storedViews.filter(
            (view): view is SavedView =>
              view &&
              typeof view.id === "string" &&
              typeof view.name === "string" &&
              typeof view.search === "string" &&
              typeof view.status === "string" &&
              typeof view.priority === "string" &&
              typeof view.assignee === "string" &&
              typeof view.due === "string" &&
              typeof view.focus === "boolean" &&
              (view.isDefault === undefined || typeof view.isDefault === "boolean"),
          )
        : [];
      setSavedViews(validViews);
      if (!stored && legacy) persistSavedViews(workspaceId, validViews);
    } catch {
      setSavedViews([]);
    }
  }, [ready, workspaceId]);

  return { savedViews, setSavedViews, persistSavedViews };
}
