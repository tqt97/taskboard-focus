import { supabase } from "../supabase";
import type { TaskAttachment } from "../types";

const maxAttachmentBytes = 10 * 1024 * 1024;

export async function uploadTaskAttachment(
  file: File,
  ownerId: string,
): Promise<TaskAttachment> {
  if (!supabase) throw new Error("Supabase Storage chưa được cấu hình.");
  if (file.size > maxAttachmentBytes) {
    throw new Error("File đính kèm không được vượt quá 10 MB.");
  }
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160) || "attachment";
  const id = crypto.randomUUID();
  const path = `${ownerId}/${id}-${safeName}`;
  const { error } = await supabase.storage
    .from("taskboard-attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(`Upload file thất bại: ${error.message}`);
  const { data } = supabase.storage.from("taskboard-attachments").getPublicUrl(path);
  return {
    id,
    name: file.name.slice(0, 255),
    url: data.publicUrl,
    size: file.size,
    mime_type: file.type || undefined,
  };
}
