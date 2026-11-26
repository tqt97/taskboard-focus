"use client";

import { createContext, useContext } from "react";
import type { RefObject, ReactNode } from "react";
import type { AppLocale, UiCopy } from "@/lib/i18n";
import type { BoardData, SavedView, SortMode, Task, TaskTemplate } from "@/lib/types";
import type { WorkspaceView } from "../layout/WorkspaceShell";

export type WorkspaceRuntimeValue = {
  view: WorkspaceView;
  data: BoardData;
  now: Date;
  locale: AppLocale;
  copy: UiCopy;
  canEditWorkspace: boolean;
  activeTasks: Task[];
  todayTasks: Task[];
  visibleTasks: Task[];
  reminderItems: Array<{ task: Task; label: string; date: string }>;
  upcomingGroups: Array<{
    label: string;
    items: Array<{ task: Task; label: string; date: string }>;
  }>;
  templates: TaskTemplate[];
  sortMode: SortMode;
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
  selectionMode: boolean;
  selectedTaskIds: string[];
  toggleSelectionMode: () => void;
  setSelectedTaskIds: (ids: string[]) => void;
  taskCard: (task: Task) => ReactNode;
  dropOnStatus: (status: Task["status"], targetId?: string) => void;
  bulkUpdateTasks: (patch: Partial<Task>, message: string) => void;
  savedViews: SavedView[];
  selectedSavedViewId: string;
  applySavedView: (id: string) => void;
  saveCurrentView: () => void;
  deleteSavedView: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
  advancedFiltersOpen: boolean;
  setAdvancedFiltersOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  archiveFilter: "active" | "archived";
  setArchiveFilter: (value: "active" | "archived") => void;
  assigneeFilter: string;
  setAssigneeFilter: (value: string) => void;
  dueFilter: string;
  setDueFilter: (value: string) => void;
  onOpenTask: (task: Task) => void;
  onBrowseTasks: () => void;
  onUpdateDeadline: (task: Task, deadline: Date) => void;
  dueText: (value: string, copy: UiCopy) => string;
  dueState: (value: string) => string;
  formatDate: (value: string, locale: AppLocale) => string;
  onOpenSettings: () => void;
};

const WorkspaceRuntimeContext = createContext<WorkspaceRuntimeValue | null>(null);

export function WorkspaceRuntimeProvider({
  value,
  children,
}: {
  value: WorkspaceRuntimeValue;
  children: ReactNode;
}) {
  return (
    <WorkspaceRuntimeContext.Provider value={value}>
      {children}
    </WorkspaceRuntimeContext.Provider>
  );
}

export function useWorkspaceRuntime() {
  const value = useContext(WorkspaceRuntimeContext);
  if (!value)
    throw new Error("Workspace view phải nằm trong WorkspaceRuntimeProvider.");
  return value;
}
