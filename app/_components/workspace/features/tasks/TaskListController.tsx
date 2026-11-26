"use client";

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
import { Select } from "@/app/_components/ui/Select";
import { useWorkspaceRuntime } from "../../state/WorkspaceProvider";

const TaskBoardColumns = dynamic(
  () => import("./TaskBoardColumns").then((module) => module.TaskBoardColumns),
  {
    ssr: false,
    loading: () => <div className="board-loading" aria-busy="true" />,
  },
);

export function TaskListController() {
  const runtime = useWorkspaceRuntime();
  const {
    view,
    data,
    copy,
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
  } = runtime;
  const labels = copy.status;
  const priorityLabels = copy.priority;
  const tasks = view === "today" ? todayTasks : visibleTasks;

  return (
    <section className="tasks-panel panel">
      <div className="panel-heading">
        <div>
          <h2>Ưu tiên công việc</h2>
          <p>
            {tasks.length} task
            {view === "today"
              ? " cần xử lý hôm nay"
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
              label: savedView.name,
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
              bulkUpdateTasks({ status: "in_progress" }, "Đã chuyển task sang Đang làm")
            }
          >
            <Check size={14} />
            Đang làm
          </Button>
          <Button
            variant="secondary"
            className="action-priority"
            onClick={() => bulkUpdateTasks({ priority: "high" }, "Đã đặt ưu tiên cao")}
          >
            <AlertTriangle size={14} />
            Ưu tiên cao
          </Button>
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
      <TaskBoardColumns tasks={tasks} taskCard={taskCard} onDropStatus={dropOnStatus} />
    </section>
  );
}
