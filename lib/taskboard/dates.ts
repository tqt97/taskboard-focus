export const toDateInputValue = (value: string) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export const fromDateInputValue = (value: string) =>
  value ? new Date(value).toISOString() : "";

export const toDateTimeLocalValue = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export const fromDateTimeLocalValue = (value: string) =>
  value ? new Date(value).toISOString() : "";
