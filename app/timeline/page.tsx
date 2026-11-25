import Board from "@/app/_components/workspace/Board";

export const metadata = {
  title: "Calendar & timeline | Taskboard",
  description:
    "Theo dõi Dev up, Staging up, Release và Deadline trên lịch và timeline Taskboard.",
  alternates: { canonical: "/timeline" },
};

export default function TimelinePage() {
  return <Board />;
}
