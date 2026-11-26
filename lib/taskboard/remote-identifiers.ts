const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const remoteLegacyPrefix = (ownerId: string, workspaceId?: string) =>
  `legacy:${workspaceId ? `workspace:${workspaceId}` : `owner:${ownerId}`}:`;

export const fromRemoteEntityId = (
  id: string,
  ownerId?: string,
  workspaceId?: string,
) => {
  if (!ownerId || uuidPattern.test(id)) return id;
  const prefix = remoteLegacyPrefix(ownerId, workspaceId);
  if (!id.startsWith(prefix)) return id;
  try {
    return decodeURIComponent(id.slice(prefix.length));
  } catch {
    return id;
  }
};
