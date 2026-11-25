const toMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
};

export function isWithinQuietHours(
  date: Date,
  start: string,
  end: string,
  timeZone?: string,
) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes)
    return false;
  let currentMinutes: number;
  if (!timeZone) {
    currentMinutes = date.getHours() * 60 + date.getMinutes();
  } else {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      const minute = Number(parts.find((part) => part.type === "minute")?.value);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
      currentMinutes = (hour % 24) * 60 + minute;
    } catch {
      return false;
    }
  }
  return startMinutes < endMinutes
    ? currentMinutes >= startMinutes && currentMinutes < endMinutes
    : currentMinutes >= startMinutes || currentMinutes < endMinutes;
}
