import type { Metadata } from "next";

export const siteMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Taskboard — Theo dõi công việc và mốc phát hành",
  description:
    "Bảng quản lý task cá nhân: theo dõi ưu tiên, người phụ trách, deadline, Dev up, Staging up và Release.",
  applicationName: "Taskboard",
  generator: "Next.js",
  keywords: ["task management", "kanban", "deadline", "taskboard", "quản lý công việc"],
  authors: [{ name: "Taskboard" }],
  creator: "Taskboard",
  publisher: "Taskboard",
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { telephone: false },
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    siteName: "Taskboard",
    title: "Taskboard — Theo dõi công việc và mốc phát hành",
    description: "Bảng quản lý task cá nhân với Kanban, deadline và tiến độ phát hành.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Taskboard — Theo dõi công việc và mốc phát hành",
    description: "Bảng quản lý task cá nhân với Kanban, deadline và tiến độ phát hành.",
  },
  robots: { index: false, follow: false },
};
