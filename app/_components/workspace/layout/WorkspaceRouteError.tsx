"use client";

import { ErrorState } from "../../layout/ErrorState";

export default function WorkspaceRouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState reset={reset} />;
}
