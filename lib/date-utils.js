// lib/date-utils.js — Timezone-safe date helpers

export function localDateStr(date = new Date()) {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD in local tz
}
