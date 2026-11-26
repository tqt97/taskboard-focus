"use client";

import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  CheckCheck,
  ChevronDown,
  Filter,
  ListFilter,
  Save,
  Search,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
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
          <button
            className={`selection-toggle${selectionMode ? " active" : ""}`}
            type="button"
            aria-pressed={selectionMode}
            onClick={toggleSelectionMode}
          >
            <CheckCheck size={14} />
            {selectionMode ? "Đang chọn" : "Chọn nhiều"}
          </button>
          <div className="view-switch">
            <button
              className={focusMode ? "" : "selected"}
              onClick={() => setFocusMode(false)}
            >
              Kanban
            </button>
            <button
              className={focusMode ? "selected" : ""}
              onClick={() => setFocusMode(true)}
            >
              Focus
            </button>
            <span className="view-switch-note">
              {sortMode === "manual" ? "Thứ tự kéo thả" : "Ưu tiên → deadline"}
            </span>
          </div>
        </div>
      </div>
      <div className="saved-view-bar">
        <span>Saved views</span>
        <select
          aria-label="Chọn saved view"
          value={selectedSavedViewId}
          onChange={(event) => applySavedView(event.target.value)}
        >
          <option value="">Chọn view đã lưu</option>
          {savedViews.map((savedView) => (
            <option value={savedView.id} key={savedView.id}>
              {savedView.name}
            </option>
          ))}
        </select>
        <button className="text-button" onClick={saveCurrentView}>
          <Save size={14} />
          Lưu view hiện tại
        </button>
        <button
          className="text-button"
          onClick={deleteSavedView}
          disabled={!selectedSavedViewId}
          aria-label="Xóa bộ lọc đã lưu"
        >
          <X size={14} />
          Xóa view
        </button>
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
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Mọi trạng thái</option>
            {Object.entries(labels).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
        <label className="select-wrap priority-filter">
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="all">Mọi ưu tiên</option>
            {Object.entries(priorityLabels).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
        <button
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
        </button>
        {advancedFiltersOpen && (
          <>
            <label className="select-wrap advanced-filter">
              <select
                value={archiveFilter}
                onChange={(event) =>
                  setArchiveFilter(event.target.value as "active" | "archived")
                }
              >
                <option value="active">Đang hoạt động</option>
                <option value="archived">Đã lưu trữ</option>
              </select>
              <ChevronDown size={13} />
            </label>
            <label className="select-wrap advanced-filter">
              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="all">Mọi người phụ trách</option>
                <option value="__unassigned">Chưa giao</option>
                {data.members
                  .filter((member) => member.active)
                  .map((member) => (
                    <option value={member.id} key={member.id}>
                      {member.name}
                    </option>
                  ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <label className="select-wrap advanced-filter">
              <select
                value={dueFilter}
                onChange={(event) => setDueFilter(event.target.value)}
              >
                <option value="all">Mọi deadline</option>
                <option value="overdue">Quá hạn</option>
                <option value="today">Hôm nay</option>
                <option value="week">7 ngày tới</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </>
        )}
      </div>
      {selectedTaskIds.length > 0 && (
        <div className="bulk-toolbar" role="toolbar" aria-label="Thao tác hàng loạt">
          <strong>{selectedTaskIds.length} task đã chọn</strong>
          <button
            className="secondary-button action-progress"
            onClick={() =>
              bulkUpdateTasks({ status: "in_progress" }, "Đã chuyển task sang Đang làm")
            }
          >
            <Check size={14} />
            Đang làm
          </button>
          <button
            className="secondary-button action-priority"
            onClick={() => bulkUpdateTasks({ priority: "high" }, "Đã đặt ưu tiên cao")}
          >
            <AlertTriangle size={14} />
            Ưu tiên cao
          </button>
          <button
            className="text-button action-clear"
            onClick={() => setSelectedTaskIds([])}
          >
            <X size={14} />
            Bỏ chọn
          </button>
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
