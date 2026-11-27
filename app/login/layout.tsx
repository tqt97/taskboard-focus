import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng nhập | Taskboard",
  description: "Đăng nhập workspace Taskboard cloud.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
