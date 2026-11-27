"use client";

import { useState } from "react";
import type { BoardData, Task } from "@/lib/types";

export function useWorkspaceModalController() {
  const [modal, setModal] = useState<"task" | "settings" | "quick-capture" | null>(
    null,
  );
  const [edit, setEdit] = useState<Task | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<BoardData | null>(null);
  const [settingsTab, setSettingsTab] = useState("members");
  const [templateCreateMode, setTemplateCreateMode] = useState(false);

  return {
    modal,
    setModal,
    edit,
    setEdit,
    confirm,
    setConfirm,
    importPreview,
    setImportPreview,
    settingsTab,
    setSettingsTab,
    templateCreateMode,
    setTemplateCreateMode,
  };
}
