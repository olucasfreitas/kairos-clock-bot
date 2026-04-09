export const BRAZIL_TZ = "America/Sao_Paulo";
export const HOLIDAY_YEAR = 2026;

process.env.TZ = BRAZIL_TZ;

export function shouldSkipToday(now, holidays) {
  const day = now.getDay();

  if (day === 0 || day === 6) {
    return "weekend";
  }

  return holidays.includes(formatDateKey(now)) ? "holiday" : undefined;
}

export function formatDateKey(now) {
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("-");
}

export function formatTimestamp(now) {
  return `${formatDateKey(now)}T${[
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join(":")}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
