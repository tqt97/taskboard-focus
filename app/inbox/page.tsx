import Board from "@/app/_components/workspace/Board";

export const metadata = {
  title: "Inbox | Taskboard",
  description: "Phân loại nhanh các task mới trước khi đưa vào luồng xử lý.",
  alternates: { canonical: "/inbox" },
};

export default function InboxPage() {
  return <Board />;
}
