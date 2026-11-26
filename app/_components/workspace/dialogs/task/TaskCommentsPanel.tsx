"use client";

import { Button } from "@/app/_components/ui/Button";
import { useState } from "react";
import { Pin, Reply } from "lucide-react";
import type { Member, TaskComment } from "@/lib/types";
import type { AppLocale } from "@/lib/i18n";
import { Select } from "@/app/_components/ui/Select";
import { createTaskComment } from "@/lib/taskboard/comments";
import { formatActivityDate } from "@/lib/taskboard/activity";

export function TaskCommentsPanel({
  comments = [],
  members,
  locale,
  authorId,
  canComment,
  onAddComment,
  onTogglePin,
}: {
  comments?: TaskComment[];
  members: Member[];
  locale: AppLocale;
  authorId?: string;
  canComment: boolean;
  onAddComment: (comment: TaskComment) => void;
  onTogglePin: (commentId: string) => void;
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string>();
  const [error, setError] = useState("");

  const submit = () => {
    const comment = createTaskComment({ body, authorId, parentId: replyTo, members });
    if (!comment) {
      setError("Comment không được để trống và không quá 5.000 ký tự.");
      return;
    }
    onAddComment(comment);
    setBody("");
    setReplyTo(undefined);
    setError("");
  };

  return (
    <section className="task-comments-panel" id="task-comments-panel" role="tabpanel">
      <div className="form-block-heading">
        <div>
          <h3>Thảo luận</h3>
          <p>Trao đổi theo task; mention thành viên để gửi thông báo.</p>
        </div>
      </div>
      <div className="task-comment-list">
        {comments.length ? (
          comments.map((comment) => {
            const author = members.find((member) => member.id === comment.author_id);
            return (
              <article
                className={[
                  "task-comment",
                  comment.pinned ? "pinned" : "",
                  comment.parent_id ? "reply" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={comment.id}
              >
                <div className="task-comment-heading">
                  <b>{author?.name || "Thành viên"}</b>
                  <small>{formatActivityDate(comment.created_at, locale)}</small>
                </div>
                {comment.parent_id && (
                  <small className="task-comment-reply-label">
                    ↳ Trả lời comment trước đó
                  </small>
                )}
                <p>{comment.body}</p>
                <div className="task-comment-actions">
                  <Button
                    type="button"
                    variant="text"
                    disabled={!canComment}
                    onClick={() => setReplyTo(comment.id)}
                  >
                    <Reply size={13} /> Trả lời
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    disabled={!canComment}
                    onClick={() => onTogglePin(comment.id)}
                  >
                    <Pin size={13} /> {comment.pinned ? "Bỏ ghim" : "Ghim"}
                  </Button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="history-empty">
            <b>Chưa có thảo luận</b>
            <small>Hãy để lại comment đầu tiên cho task này.</small>
          </div>
        )}
      </div>
      {canComment && (
        <div className="task-comment-composer">
          {replyTo && (
            <small>
              Đang trả lời một comment{" "}
              <Button
                type="button"
                variant="text"
                onClick={() => setReplyTo(undefined)}
              >
                Hủy
              </Button>
            </small>
          )}
          <textarea
            aria-label="Nội dung comment"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Viết comment hoặc dùng @ để mention thành viên..."
            rows={3}
          />
          {error && (
            <small className="error-message" role="alert">
              {error}
            </small>
          )}
          <div className="task-comment-composer-footer">
            <Select
              aria-label="Mention thành viên"
              value=""
              options={[
                { value: "", label: "Mention thành viên" },
                ...members
                  .filter((member) => member.active)
                  .map((member) => ({ value: member.id, label: `@${member.name}` })),
              ]}
              onValueChange={(value) => {
                const member = members.find((item) => item.id === value);
                if (member)
                  setBody(
                    (current) =>
                      `${current}${current && !current.endsWith(" ") ? " " : ""}@${member.name} `,
                  );
              }}
            />
            <Button
              type="button"
              variant="primary"
              disabled={!body.trim()}
              onClick={submit}
            >
              Gửi comment
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
