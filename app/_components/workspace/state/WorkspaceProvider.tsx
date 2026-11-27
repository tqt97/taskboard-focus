"use client";

import { createContext, useContext, useMemo } from "react";
import type { Context, ReactNode, RefObject } from "react";
import type { AppLocale, UiCopy } from "@/lib/i18n";
import type { BoardData, SavedView, SortMode, Task, TaskTemplate } from "@/lib/types";
import type { WorkspaceView } from "../layout/workspace-routes";

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
  onQuickUpdate: (task: Task) => void;
  onBrowseTasks: () => void;
  onUpdateDeadline: (task: Task, deadline: Date) => void;
  dueText: (value: string, copy: UiCopy) => string;
  dueState: (value: string) => string;
  formatDate: (value: string, locale: AppLocale) => string;
  onOpenSettings: () => void;
};

type WorkspaceDataValue = Pick<
  WorkspaceRuntimeValue,
  | "data"
  | "now"
  | "locale"
  | "copy"
  | "activeTasks"
  | "todayTasks"
  | "visibleTasks"
  | "reminderItems"
  | "upcomingGroups"
  | "templates"
  | "sortMode"
  | "dueText"
  | "dueState"
  | "formatDate"
>;
type WorkspaceFiltersValue = Pick<
  WorkspaceRuntimeValue,
  | "focusMode"
  | "setFocusMode"
  | "selectionMode"
  | "selectedTaskIds"
  | "toggleSelectionMode"
  | "setSelectedTaskIds"
  | "savedViews"
  | "selectedSavedViewId"
  | "searchRef"
  | "search"
  | "setSearch"
  | "statusFilter"
  | "setStatusFilter"
  | "priorityFilter"
  | "setPriorityFilter"
  | "advancedFiltersOpen"
  | "setAdvancedFiltersOpen"
  | "archiveFilter"
  | "setArchiveFilter"
  | "assigneeFilter"
  | "setAssigneeFilter"
  | "dueFilter"
  | "setDueFilter"
>;
type WorkspaceActionsValue = Pick<
  WorkspaceRuntimeValue,
  | "taskCard"
  | "dropOnStatus"
  | "bulkUpdateTasks"
  | "applySavedView"
  | "saveCurrentView"
  | "deleteSavedView"
  | "onOpenTask"
  | "onQuickUpdate"
  | "onBrowseTasks"
  | "onUpdateDeadline"
  | "onOpenSettings"
>;
type WorkspaceViewValue = Pick<WorkspaceRuntimeValue, "view" | "canEditWorkspace">;

const WorkspaceDataContext = createContext<WorkspaceDataValue | null>(null);
const WorkspaceFiltersContext = createContext<WorkspaceFiltersValue | null>(null);
const WorkspaceActionsContext = createContext<WorkspaceActionsValue | null>(null);
const WorkspaceViewContext = createContext<WorkspaceViewValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceRuntimeValue;
  children: ReactNode;
}) {
  const data = useMemo<WorkspaceDataValue>(
    () => ({
      data: value.data,
      now: value.now,
      locale: value.locale,
      copy: value.copy,
      activeTasks: value.activeTasks,
      todayTasks: value.todayTasks,
      visibleTasks: value.visibleTasks,
      reminderItems: value.reminderItems,
      upcomingGroups: value.upcomingGroups,
      templates: value.templates,
      sortMode: value.sortMode,
      dueText: value.dueText,
      dueState: value.dueState,
      formatDate: value.formatDate,
    }),
    [
      value.activeTasks,
      value.copy,
      value.data,
      value.dueState,
      value.dueText,
      value.formatDate,
      value.locale,
      value.now,
      value.reminderItems,
      value.sortMode,
      value.templates,
      value.todayTasks,
      value.upcomingGroups,
      value.visibleTasks,
    ],
  );
  const filters = useMemo<WorkspaceFiltersValue>(
    () => ({
      focusMode: value.focusMode,
      setFocusMode: value.setFocusMode,
      selectionMode: value.selectionMode,
      selectedTaskIds: value.selectedTaskIds,
      toggleSelectionMode: value.toggleSelectionMode,
      setSelectedTaskIds: value.setSelectedTaskIds,
      savedViews: value.savedViews,
      selectedSavedViewId: value.selectedSavedViewId,
      searchRef: value.searchRef,
      search: value.search,
      setSearch: value.setSearch,
      statusFilter: value.statusFilter,
      setStatusFilter: value.setStatusFilter,
      priorityFilter: value.priorityFilter,
      setPriorityFilter: value.setPriorityFilter,
      advancedFiltersOpen: value.advancedFiltersOpen,
      setAdvancedFiltersOpen: value.setAdvancedFiltersOpen,
      archiveFilter: value.archiveFilter,
      setArchiveFilter: value.setArchiveFilter,
      assigneeFilter: value.assigneeFilter,
      setAssigneeFilter: value.setAssigneeFilter,
      dueFilter: value.dueFilter,
      setDueFilter: value.setDueFilter,
    }),
    [
      value.advancedFiltersOpen,
      value.archiveFilter,
      value.assigneeFilter,
      value.dueFilter,
      value.focusMode,
      value.priorityFilter,
      value.savedViews,
      value.search,
      value.searchRef,
      value.selectedSavedViewId,
      value.selectedTaskIds,
      value.selectionMode,
      value.setAdvancedFiltersOpen,
      value.setArchiveFilter,
      value.setAssigneeFilter,
      value.setDueFilter,
      value.setFocusMode,
      value.setPriorityFilter,
      value.setSearch,
      value.setSelectedTaskIds,
      value.setStatusFilter,
      value.toggleSelectionMode,
    ],
  );
  const actions = useMemo<WorkspaceActionsValue>(
    () => ({
      taskCard: value.taskCard,
      dropOnStatus: value.dropOnStatus,
      bulkUpdateTasks: value.bulkUpdateTasks,
      applySavedView: value.applySavedView,
      saveCurrentView: value.saveCurrentView,
      deleteSavedView: value.deleteSavedView,
      onOpenTask: value.onOpenTask,
      onQuickUpdate: value.onQuickUpdate,
      onBrowseTasks: value.onBrowseTasks,
      onUpdateDeadline: value.onUpdateDeadline,
      onOpenSettings: value.onOpenSettings,
    }),
    [
      value.applySavedView,
      value.bulkUpdateTasks,
      value.deleteSavedView,
      value.dropOnStatus,
      value.onBrowseTasks,
      value.onOpenSettings,
      value.onOpenTask,
      value.onQuickUpdate,
      value.onUpdateDeadline,
      value.saveCurrentView,
      value.taskCard,
    ],
  );
  const view = useMemo<WorkspaceViewValue>(
    () => ({ view: value.view, canEditWorkspace: value.canEditWorkspace }),
    [value.canEditWorkspace, value.view],
  );
  return (
    <WorkspaceViewContext.Provider value={view}>
      <WorkspaceDataContext.Provider value={data}>
        <WorkspaceFiltersContext.Provider value={filters}>
          <WorkspaceActionsContext.Provider value={actions}>
            {children}
          </WorkspaceActionsContext.Provider>
        </WorkspaceFiltersContext.Provider>
      </WorkspaceDataContext.Provider>
    </WorkspaceViewContext.Provider>
  );
}

function useRequiredContext<T>(context: Context<T | null>, message: string) {
  const value = useContext(context);
  if (!value) throw new Error(message);
  return value;
}

export function useWorkspaceData() {
  return useRequiredContext(
    WorkspaceDataContext,
    "Workspace data phải nằm trong WorkspaceProvider.",
  );
}

export function useWorkspaceFilters() {
  return useRequiredContext(
    WorkspaceFiltersContext,
    "Workspace filters phải nằm trong WorkspaceProvider.",
  );
}

export function useWorkspaceActions() {
  return useRequiredContext(
    WorkspaceActionsContext,
    "Workspace actions phải nằm trong WorkspaceProvider.",
  );
}

export function useWorkspaceView() {
  return useRequiredContext(
    WorkspaceViewContext,
    "Workspace view phải nằm trong WorkspaceProvider.",
  );
}
