export const screenLockStorageKey = "taskboard-screen-lock-v2";
export const screenLockSessionKey = "taskboard-screen-unlocked-until-v2";

export type ScreenLockConfig = {
  displayName: string;
  passcodeHash: string;
  salt: string;
  autoLockMinutes: number;
  /** New local configs always use six digits. */
  passcodeLength?: 6;
  /** Allows one-time unlock of a config created before the six-digit migration. */
  legacyPasscodeLength?: 4;
};

export const defaultScreenLockConfig = {
  displayName: "Anonymous",
  passcode: "",
  autoLockMinutes: 15,
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export const createSalt = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
};

export async function hashPasscode(passcode: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64(new Uint8Array(digest));
}

export async function createScreenLockConfig(
  displayName: string,
  passcode: string,
  autoLockMinutes: number,
): Promise<ScreenLockConfig> {
  const salt = createSalt();
  return {
    displayName: displayName.trim() || defaultScreenLockConfig.displayName,
    passcodeHash: await hashPasscode(passcode, salt),
    salt,
    autoLockMinutes: normalizeAutoLockMinutes(autoLockMinutes),
    passcodeLength: 6,
  };
}

export async function verifyPasscode(config: ScreenLockConfig, passcode: string) {
  return (await hashPasscode(passcode, config.salt)) === config.passcodeHash;
}

export function readScreenLockConfig(): ScreenLockConfig | null {
  try {
    const raw = localStorage.getItem(screenLockStorageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ScreenLockConfig>;
    if (
      typeof value.displayName !== "string" ||
      typeof value.passcodeHash !== "string" ||
      typeof value.salt !== "string" ||
      typeof value.autoLockMinutes !== "number" ||
      !Number.isFinite(value.autoLockMinutes) ||
      (value.passcodeLength !== undefined && value.passcodeLength !== 6)
    )
      return null;
    return {
      displayName: value.displayName.trim() || defaultScreenLockConfig.displayName,
      passcodeHash: value.passcodeHash,
      salt: value.salt,
      autoLockMinutes: normalizeAutoLockMinutes(value.autoLockMinutes),
      passcodeLength: 6,
      ...(value.passcodeLength === undefined
        ? { legacyPasscodeLength: 4 as const }
        : {}),
    };
  } catch {
    return null;
  }
}

export const saveScreenLockConfig = (config: ScreenLockConfig) => {
  try {
    localStorage.setItem(screenLockStorageKey, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
};

export const readUnlockDeadline = () => {
  try {
    return Number(sessionStorage.getItem(screenLockSessionKey) || 0);
  } catch {
    return 0;
  }
};

export const setUnlockDeadline = (deadline: number) => {
  try {
    sessionStorage.setItem(screenLockSessionKey, String(deadline));
  } catch {}
};

export const clearUnlockSession = () => {
  try {
    sessionStorage.removeItem(screenLockSessionKey);
  } catch {}
};

export const normalizeAutoLockMinutes = (value: number) =>
  [0, 1, 5, 15, 30, 60].includes(value) ? value : 15;
