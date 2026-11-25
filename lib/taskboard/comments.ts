import type { Member, TaskComment } from "../types";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mentionsMember = (body: string, name: string) => {
  const pattern = new RegExp(
    `(^|[\\s([{])@${escapeRegExp(name)}(?=$|[\\s\\]},.!?;:)])`,
    "iu",
  );
  return pattern.test(body);
};

export const extractMentionIds = (body: string, members: Member[]) =>
  members
    .filter((member) => mentionsMember(body, member.name))
    .map((member) => member.id);

export const createTaskComment = ({
  body,
  authorId,
  parentId,
  members,
  now = new Date(),
}: {
  body: string;
  authorId?: string;
  parentId?: string;
  members: Member[];
  now?: Date;
}): TaskComment | null => {
  const normalizedBody = body.trim();
  if (!normalizedBody || normalizedBody.length > 5000) return null;
  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    author_id: authorId,
    body: normalizedBody,
    parent_id: parentId,
    mention_ids: extractMentionIds(normalizedBody, members),
    created_at: timestamp,
    updated_at: timestamp,
  };
};
