import { intlLocale, type AppLocale } from "../i18n/index.ts";

export const formatActivityDate = (value: string, locale: AppLocale) =>
  new Intl.DateTimeFormat(intlLocale[locale], {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

export const formatActivityValue = (field: string, value: string, locale: AppLocale) =>
  /deadline|dev up|staging up|release/i.test(field) && value !== "Chưa đặt"
    ? formatActivityDate(value, locale)
    : value;
