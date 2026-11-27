"use client";

import styles from "./TaskListController.module.css";
import { Button } from "@/app/_components/ui/Button";
import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  CheckCheck,
  Filter,
  ListFilter,
  Save,
  Search,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Select } from "@/app/_components/ui/Select";
import {
  useWorkspaceActions,
  useWorkspaceData,
  useWorkspaceFilters,
  useWorkspaceView,
} from "../../state/WorkspaceProvider";
import { TaskFlatList } from "./TaskFlatList";

const TaskBoardColumns = dynamic(
  () => import("./TaskBoardColumns").then((module) => module.TaskBoardColumns),
  {
    ssr: false,
    loading: () => <div className="board-loading" aria-busy="true" />,
  },
);

export function TaskListController() {
  const [bulkDeadline, setBulkDeadline] = useState("");
  const { view } = useWorkspaceView();
  const dataContext = useWorkspaceData();
  const filtersContext = useWorkspaceFilters();
  const actionsContext = useWorkspaceActions();
  const {
    data,
    copy,
    dueState,
    visibleTasks,
    todayTasks,
    focusMode,
    setFocusMode,
    selectionMode,
    selectedTaskIds,
    toggleSelectionMode,
    setSelectedTaskIds,
    sortMode,
    savedViews,
    selectedSavedViewId,
    applySavedView,
    saveCurrentView,
    deleteSavedView,
    renameSavedView,
    duplicateSavedView,
    setDefaultSavedView,
    searchRef,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    advancedFiltersOpen,
    setAdvancedFiltersOpen,
    archiveFilter,
    setArchiveFilter,
    assigneeFilter,
    setAssigneeFilter,
    dueFilter,
    setDueFilter,
    bulkUpdateTasks,
    taskCard,
    dropOnStatus,
  } = {
    ...dataContext,
    ...filtersContext,
    ...actionsContext,
  };
  const labels = copy.status;
  const priorityLabels = copy.priority;
  const tasks = useMemo(() => {
    const source = view === "today" ? todayTasks : visibleTasks;
    if (view === "tasks") return source;
    return [...source].sort((a, b) => {
      if (view === "drafts") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      const aOverdue = a.deadline && dueState(a.deadline) === "overdue" ? 0 : 1;
      const bOverdue = b.deadline && dueState(b.deadline) === "overdue" ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDifference) return priorityDifference;
      return (
        new Date(a.deadline || "9999-12-31").getTime() -
        new Date(b.deadline || "9999-12-31").getTime()
      );
    });
  }, [dueState, todayTasks, view, visibleTasks]);

  return (
    <div className={styles.taskScope}>
      <section className="tasks-panel panel">
        <div className="panel-heading">
          <div>
            <h2>Ưu tiên công việc</h2>
            <p>
              {tasks.length} task
              {view === "today"
                ? " cần xử lý hôm nay"
                : view === "drafts"
                  ? " bản nháp gần đây"
                  : focusMode
                    ? " cần tập trung"
                    : " · trạng thái đi từ trái sang phải"}
            </p>
          </div>
          <div className="task-panel-actions">
            <Button
              className={`selection-toggle${selectionMode ? " active" : ""}`}
              type="button"
              aria-pressed={selectionMode}
              onClick={toggleSelectionMode}
            >
              <CheckCheck size={14} />
              {selectionMode ? "Đang chọn" : "Chọn nhiều"}
            </Button>
            {view === "tasks" && (
              <div className="view-switch">
                <Button
                  className={focusMode ? "" : "selected"}
                  onClick={() => setFocusMode(false)}
                >
                  Kanban
                </Button>
                <Button
                  className={focusMode ? "selected" : ""}
                  onClick={() => setFocusMode(true)}
                >
                  Focus
                </Button>
                <span className="view-switch-note">
                  {sortMode === "manual" ? "Thứ tự kéo thả" : "Ưu tiên → deadline"}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="saved-view-bar">
          <span>Saved views</span>
          <Select
            aria-label="Chọn saved view"
            value={selectedSavedViewId}
            options={[
              { value: "", label: "Chọn view đã lưu" },
              ...savedViews.map((savedView) => ({
                value: savedView.id,
                label: savedView.isDefault ? `★ ${savedView.name}` : savedView.name,
              })),
            ]}
            onValueChange={applySavedView}
          />
          <Button variant="text" onClick={saveCurrentView}>
            <Save size={14} />
            Lưu view hiện tại
          </Button>
          <Button
            variant="text"
            onClick={renameSavedView}
            disabled={!selectedSavedViewId}
          >
            Đổi tên
          </Button>
          <Button
            variant="text"
            onClick={duplicateSavedView}
            disabled={!selectedSavedViewId}
          >
            Nhân bản
          </Button>
          <Button
            variant="text"
            onClick={setDefaultSavedView}
            disabled={!selectedSavedViewId}
          >
            Đặt mặc định
          </Button>
          <Button
            variant="text"
            className="danger-text"
            onClick={deleteSavedView}
            disabled={!selectedSavedViewId}
            aria-label="Xóa bộ lọc đã lưu"
          >
            <X size={14} />
            Xóa view
          </Button>
        </div>
        <div className="filters">
          <label className="search-box">
            <Search size={16} />
            <input
              ref={searchRef}
              placeholder="Tìm task, mã, mô tả..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd>Ctrl/⌘ K</kbd>
          </label>
          {view === "tasks" && (
            <label className="select-wrap">
              <Filter size={15} />
              <Select
                aria-label="Lọc theo trạng thái"
                value={statusFilter}
                options={[
                  { value: "all", label: "Mọi trạng thái" },
                  ...Object.entries(labels).map(([value, label]) => ({ value, label })),
                ]}
                onValueChange={setStatusFilter}
              />
            </label>
          )}
          <label className="select-wrap priority-filter">
            <Select
              aria-label="Lọc theo mức ưu tiên"
              value={priorityFilter}
              options={[
                { value: "all", label: "Mọi ưu tiên" },
                ...Object.entries(priorityLabels).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              onValueChange={setPriorityFilter}
            />
          </label>
          <Button
            className={`filter-toggle${advancedFiltersOpen ? " active" : ""}`}
            type="button"
            aria-expanded={advancedFiltersOpen}
            onClick={() => setAdvancedFiltersOpen((open) => !open)}
          >
            <ListFilter size={14} />
            Bộ lọc nâng cao
            {(assigneeFilter !== "all" || dueFilter !== "all") && (
              <span className="filter-count">
                {Number(assigneeFilter !== "all") + Number(dueFilter !== "all")}
              </span>
            )}
          </Button>
          {advancedFiltersOpen && (
            <>
              <label className="select-wrap advanced-filter">
                <Select
                  aria-label="Lọc trạng thái lưu trữ"
                  value={archiveFilter}
                  options={[
                    { value: "active", label: "Đang hoạt động" },
                    { value: "archived", label: "Đã lưu trữ" },
                  ]}
                  onValueChange={(value) =>
                    setArchiveFilter(value as "active" | "archived")
                  }
                />
              </label>
              <label className="select-wrap advanced-filter">
                <Select
                  aria-label="Lọc theo người phụ trách"
                  value={assigneeFilter}
                  options={[
                    { value: "all", label: "Mọi người phụ trách" },
                    { value: "__unassigned", label: "Chưa giao" },
                    ...data.members
                      .filter((member) => member.active)
                      .map((member) => ({ value: member.id, label: member.name })),
                  ]}
                  onValueChange={setAssigneeFilter}
                />
              </label>
              <label className="select-wrap advanced-filter">
                <Select
                  aria-label="Lọc theo deadline"
                  value={dueFilter}
                  options={[
                    { value: "all", label: "Mọi deadline" },
                    { value: "overdue", label: "Quá hạn" },
                    { value: "today", label: "Hôm nay" },
                    { value: "week", label: "7 ngày tới" },
                  ]}
                  onValueChange={setDueFilter}
                />
              </label>
            </>
          )}
        </div>
        {selectedTaskIds.length > 0 && (
          <div className="bulk-toolbar" role="toolbar" aria-label="Thao tác hàng loạt">
            <strong>{selectedTaskIds.length} task đã chọn</strong>
            <Button
              variant="secondary"
              className="action-progress"
              onClick={() =>
                bulkUpdateTasks(
                  { status: "in_progress" },
                  "Đã chuyển task sang Đang làm",
                )
              }
            >
              <Check size={14} />
              Đang làm
            </Button>
            <Button
              variant="secondary"
              className="action-priority"
              onClick={() =>
                bulkUpdateTasks({ priority: "high" }, "Đã đặt ưu tiên cao")
              }
            >
              <AlertTriangle size={14} />
              Ưu tiên cao
            </Button>
            <Select
              aria-label="Giao task đã chọn cho thành viên"
              value=""
              options={[
                { value: "", label: "Giao cho..." },
                ...data.members
                  .filter((member) => member.active)
                  .map((member) => ({ value: member.id, label: member.name })),
              ]}
              onValueChange={(memberId) => {
                if (!memberId) return;
                bulkUpdateTasks(
                  { assignee_id: memberId, assignee_ids: [memberId] },
                  "Đã giao các task đã chọn",
                );
              }}
            />
            <label className="bulk-deadline-field">
              <span className="sr-only">Deadline cho task đã chọn</span>
              <input
                type="date"
                aria-label="Chọn deadline cho task đã chọn"
                value={bulkDeadline}
                onChange={(event) => setBulkDeadline(event.target.value)}
              />
              <Button
                variant="secondary"
                disabled={!bulkDeadline}
                onClick={() => {
                  bulkUpdateTasks(
                    { deadline: new Date(`${bulkDeadline}T23:59:59`).toISOString() },
                    "Đã cập nhật deadline cho các task đã chọn",
                  );
                  setBulkDeadline("");
                }}
              >
                Áp deadline
              </Button>
            </label>
            <Button
              variant="text"
              className="action-clear"
              onClick={() => setSelectedTaskIds([])}
            >
              <X size={14} />
              Bỏ chọn
            </Button>
          </div>
        )}
        {view === "tasks" && (
          <div className="priority-guide">
            <span className="guide-note">
              <i className="urgent" />
              Trên cùng = cần xử lý trước
            </span>
            <span className="guide-note">
              <ArrowDownUp size={13} /> Kanban: tiến độ trái → phải
            </span>
            <div className="legend-group">
              <b>Priority</b>
              <span>
                <i className="legend-swatch urgent" />
                Khẩn
              </span>
              <span>
                <i className="legend-swatch high" />
                Cao
              </span>
              <span>
                <i className="legend-swatch medium" />
                Vừa
              </span>
              <span>
                <i className="legend-swatch low" />
                Thấp
              </span>
            </div>
            <div className="legend-group">
              <b>Severity</b>
              <span>
                <i className="legend-swatch severity-critical" />
                Nghiêm trọng
              </span>
              <span>
                <i className="legend-swatch severity-high" />
                Cao
              </span>
              <span>
                <i className="legend-swatch severity-medium" />
                Vừa
              </span>
              <span>
                <i className="legend-swatch severity-low" />
                Thấp
              </span>
            </div>
          </div>
        )}
        {view === "tasks" ? (
          <TaskBoardColumns
            tasks={tasks}
            taskCard={taskCard}
            onDropStatus={dropOnStatus}
          />
        ) : (
          <TaskFlatList tasks={tasks} taskCard={taskCard} />
        )}
      </section>
    </div>
  );
}
