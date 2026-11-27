"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const readParam = (params: URLSearchParams, key: string, fallback: string) =>
  params.get(key) || fallback;

export function useWorkspaceFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const initial = useRef(new URLSearchParams(params.toString()));
  const lastUrlRef = useRef(params.toString());
  const [search, setSearch] = useState(() => initial.current.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(() =>
    readParam(initial.current, "status", "all"),
  );
  const [priorityFilter, setPriorityFilter] = useState(() =>
    readParam(initial.current, "priority", "all"),
  );
  const [assigneeFilter, setAssigneeFilter] = useState(() =>
    readParam(initial.current, "assignee", "all"),
  );
  const [dueFilter, setDueFilter] = useState(() =>
    readParam(initial.current, "due", "all"),
  );
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived">(() =>
    readParam(initial.current, "archive", "active") === "archived"
      ? "archived"
      : "active",
  );

  useEffect(() => {
    const serialized = params.toString();
    if (serialized === lastUrlRef.current) return;
    lastUrlRef.current = serialized;
    setSearch(params.get("search") || "");
    setStatusFilter(readParam(params, "status", "all"));
    setPriorityFilter(readParam(params, "priority", "all"));
    setAssigneeFilter(readParam(params, "assignee", "all"));
    setDueFilter(readParam(params, "due", "all"));
    setArchiveFilter(params.get("archive") === "archived" ? "archived" : "active");
  }, [params]);

  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    const values: Record<string, string> = {
      search,
      status: statusFilter,
      priority: priorityFilter,
      assignee: assigneeFilter,
      due: dueFilter,
      archive: archiveFilter,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (!value || value === "all" || (key === "archive" && value === "active"))
        next.delete(key);
      else next.set(key, value);
    });
    const query = next.toString();
    const current = params.toString();
    if (query !== current) {
      const timer = window.setTimeout(
        () =>
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
        keyIsSearchOnly(values) ? 180 : 0,
      );
      return () => window.clearTimeout(timer);
    }
  }, [
    archiveFilter,
    assigneeFilter,
    dueFilter,
    params,
    pathname,
    priorityFilter,
    router,
    search,
    statusFilter,
  ]);

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    dueFilter,
    setDueFilter,
    archiveFilter,
    setArchiveFilter,
  };
}

function keyIsSearchOnly(values: Record<string, string>) {
  return (
    Boolean(values.search) &&
    Object.entries(values).every(
      ([key, value]) =>
        key === "search" ||
        !value ||
        value === "all" ||
        (key === "archive" && value === "active"),
    )
  );
}
