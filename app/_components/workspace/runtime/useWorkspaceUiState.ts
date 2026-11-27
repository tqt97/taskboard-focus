"use client";

import { useState } from "react";
import type { BoardData, SortMode } from "@/lib/types";
import type { AppLocale } from "@/lib/i18n";
import { useWorkspaceModalController } from "./useWorkspaceModalController";

export function useWorkspaceUiState() {
  const modalController = useWorkspaceModalController();
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("smart");
  const [focusMode, setFocusMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("");
  const [undoState, setUndoState] = useState<{
    data: BoardData;
    message: string;
  } | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [locale, setLocale] = useState<AppLocale>("vi");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  return {
    ...modalController,
    dark,
    setDark,
    toast,
    setToast,
    dragId,
    setDragId,
    sortMode,
    setSortMode,
    focusMode,
    setFocusMode,
    selectedTaskIds,
    setSelectedTaskIds,
    selectionMode,
    setSelectionMode,
    advancedFiltersOpen,
    setAdvancedFiltersOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
    selectedSavedViewId,
    setSelectedSavedViewId,
    undoState,
    setUndoState,
    notificationsOpen,
    setNotificationsOpen,
    readNotificationIds,
    setReadNotificationIds,
    sidebarCollapsed,
    setSidebarCollapsed,
    locale,
    setLocale,
    saveStatus,
    setSaveStatus,
  };
}
