import "../globals.css";
import { WorkspaceLayout } from "../_components/layout/WorkspaceLayout";

export default function WorkspaceRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
