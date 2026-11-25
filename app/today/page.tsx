import Board from "../_components/workspace/Board";

export const metadata = {
  title: "Today | Taskboard",
  description: "Tập trung vào task quá hạn, đến hạn hôm nay và task khẩn cấp.",
  alternates: { canonical: "/today" },
};

export default function TodayPage() {
  return <Board />;
}
