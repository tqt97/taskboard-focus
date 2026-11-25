import type { Task, TaskTemplate } from "../types";

export const createTemplateFromTask = (task: Task, name: string): TaskTemplate => ({
  id: crypto.randomUUID(),
  name: name.trim().slice(0, 120),
  title: task.title,
  description: task.description,
  priority: task.priority,
  severity: task.severity,
  recurrence: task.recurrence,
  created_at: new Date().toISOString(),
});

export const createTaskFromTemplate = (
  template: TaskTemplate,
  code: string,
  now = new Date(),
): Task => {
  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    code,
    title: template.title,
    description: template.description,
    status: "todo",
    priority: template.priority,
    severity: template.severity,
    assignee_ids: [],
    assignee_id: "",
    dev_up: "",
    staging_up: "",
    release_at: "",
    deadline: "",
    order_index: 0,
    links: [],
    recurrence: template.recurrence,
    template_id: template.id,
    created_at: timestamp,
    updated_at: timestamp,
    activity: [
      {
        id: crypto.randomUUID(),
        type: "created",
        at: timestamp,
        summary: `Tạo từ template ${template.name}`,
      },
    ],
  };
};
