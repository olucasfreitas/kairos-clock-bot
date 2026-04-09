export const BRAZIL_TZ = "America/Sao_Paulo";
export const HOLIDAY_YEAR = 2026;

// Pin native Date math to the Kairos timezone so no date library is needed.
process.env.TZ = BRAZIL_TZ;

const TARGET_HOURS = {
  morning: 10,
  evening: 19
};

export function shouldSkipToday(now, holidays) {
  const day = now.getDay();

  if (day === 0 || day === 6) {
    return "weekend";
  }

  return holidays.includes(formatDateKey(now)) ? "holiday" : undefined;
}

export function targetDateTime(now, targetSlot) {
  const target = new Date(now);

  target.setHours(getTargetHour(targetSlot), 0, 0, 0);
  return target;
}

export function msUntilTarget(now, targetSlot) {
  return Math.max(0, targetDateTime(now, targetSlot).getTime() - now.getTime());
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

function getTargetHour(targetSlot) {
  const hour = TARGET_HOURS[targetSlot];

  if (hour === undefined) {
    throw new Error(`Unknown target slot: ${targetSlot}`);
  }

  return hour;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
