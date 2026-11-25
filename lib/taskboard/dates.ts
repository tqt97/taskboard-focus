export const toDateInputValue = (value: string) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export const fromDateInputValue = (value: string) =>
  value ? new Date(value).toISOString() : "";
