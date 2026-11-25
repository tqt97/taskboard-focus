import { supabase } from "../supabase";
import type { TaskAttachment } from "../types";

const maxAttachmentBytes = 10 * 1024 * 1024;
const attachmentBucket = "taskboard-attachments";

export async function deleteTaskAttachment(storagePath: string): Promise<void> {
  if (!supabase || !storagePath) return;
  const { error } = await supabase.storage.from(attachmentBucket).remove([storagePath]);
  if (error) throw new Error(`Xóa file khỏi Storage thất bại: ${error.message}`);
}

export async function uploadTaskAttachment(
  file: File,
  ownerId: string,
  workspaceId?: string,
): Promise<TaskAttachment> {
  if (!supabase) throw new Error("Supabase Storage chưa được cấu hình.");
  if (file.size > maxAttachmentBytes) {
    throw new Error("File đính kèm không được vượt quá 10 MB.");
  }
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160) || "attachment";
  const id = crypto.randomUUID();
  const path = `${workspaceId || ownerId}/${id}-${safeName}`;
  const { error } = await supabase.storage.from(attachmentBucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`Upload file thất bại: ${error.message}`);
  const { data, error: signedUrlError } = await supabase.storage
    .from(attachmentBucket)
    .createSignedUrl(path, 60 * 60);
  if (signedUrlError || !data?.signedUrl) {
    await supabase.storage.from(attachmentBucket).remove([path]);
    throw new Error(
      `Không thể tạo link bảo mật cho file${signedUrlError ? `: ${signedUrlError.message}` : "."}`,
    );
  }
  return {
    id,
    name: file.name.slice(0, 255),
    url: data.signedUrl,
    storage_path: path,
    size: file.size,
    mime_type: file.type || undefined,
  };
}

export async function resolveTaskAttachmentUrl(
  storagePath: string,
): Promise<string | null> {
  if (!supabase || !storagePath) return null;
  const { data, error } = await supabase.storage
    .from(attachmentBucket)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
