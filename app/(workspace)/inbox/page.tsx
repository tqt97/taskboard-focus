import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Bản nháp | Taskboard",
  description: "Các công việc mới được lưu tạm trước khi đưa vào luồng xử lý.",
  alternates: { canonical: "/drafts" },
};

export default function InboxPage() {
  redirect("/drafts");
}
