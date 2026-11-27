"use client";

import { useCallback, useEffect, useRef } from "react";
import type { BoardData } from "@/lib/types";
import { parseBoardData } from "@/lib/data";

type WorkspaceChannelMessage = {
  type?: string;
  data?: unknown;
};

export function useWorkspaceChannel({
  workspaceId,
  ready,
  onRemoteData,
}: {
  workspaceId: string;
  ready: boolean;
  onRemoteData: (data: BoardData) => void;
}) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const remoteUpdateRef = useRef(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !ready ||
      typeof BroadcastChannel === "undefined"
    )
      return;
    const channel = new BroadcastChannel(`taskboard-workspace-${workspaceId}`);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<WorkspaceChannelMessage>) => {
      if (event.data?.type !== "workspace-updated") return;
      const parsed = parseBoardData(event.data.data);
      if (parsed) {
        remoteUpdateRef.current = true;
        onRemoteData(parsed);
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [onRemoteData, ready, workspaceId]);

  return useCallback((data: BoardData) => {
    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      return;
    }
    channelRef.current?.postMessage({ type: "workspace-updated", data });
  }, []);
}
