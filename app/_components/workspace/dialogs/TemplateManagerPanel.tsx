"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { TaskTemplate } from "@/lib/types";

export function TemplateManagerPanel({
  templates,
  onRename,
  onDelete,
  readOnly = false,
}: {
  templates: TaskTemplate[];
  onRename: (id: string, name: string) => boolean;
  onDelete: (id: string) => boolean;
  readOnly?: boolean;
}) {
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState("");
  const [deleteId, setDeleteId] = useState("");

  return (
    <div className="template-manager-list">
      {templates.length ? (
        templates.map((template) => (
          <article className="template-manager-row" key={template.id}>
            {editingId === template.id ? (
              <form
                className="template-manager-edit"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (onRename(template.id, draft)) setEditingId("");
                }}
              >
                <input
                  autoFocus
                  aria-label={`Tên template ${template.name}`}
                  maxLength={120}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button className="icon-button" aria-label="Lưu tên template">
                  <Check size={16} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Hủy đổi tên"
                  onClick={() => setEditingId("")}
                >
                  <X size={16} />
                </button>
              </form>
            ) : (
              <>
                <div>
                  <b>{template.name}</b>
                  <small>{template.title}</small>
                </div>
                {readOnly ? (
                  <small>Chỉ xem</small>
                ) : deleteId === template.id ? (
                  <div className="template-manager-actions">
                    <button
                      className="text-button danger-text"
                      onClick={() => {
                        if (onDelete(template.id)) setDeleteId("");
                      }}
                    >
                      Xác nhận xóa
                    </button>
                    <button className="text-button" onClick={() => setDeleteId("")}>
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="template-manager-actions">
                    <button
                      className="icon-button"
                      aria-label={`Đổi tên ${template.name}`}
                      onClick={() => {
                        setDraft(template.name);
                        setEditingId(template.id);
                        setDeleteId("");
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button danger-text"
                      aria-label={`Xóa ${template.name}`}
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </>
            )}
          </article>
        ))
      ) : (
        <p className="empty-small">
          Chưa có template. Mở task rồi chọn “Lưu thành template” để tạo.
        </p>
      )}
    </div>
  );
}
