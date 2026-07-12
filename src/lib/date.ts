const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_SHORT_KO = ["일", "월", "화", "수", "목", "금", "토"];

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

/**
 * 날짜를 프로젝트 규약에 맞게 포맷합니다.
 * - full: yyyy-mm-dd(ddd) → 2026-03-07(Sat)
 * - short: mm-dd(ddd) → 03-07(Sat)
 */
export function formatDate(
  date: Date | string,
  format: "full" | "short" | "date" | "compact" | "tooltip" = "full"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValidDate(d)) {
    return "-";
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const dayName = DAY_NAMES_SHORT[d.getDay()];
  const dayNameKo = DAY_NAMES_SHORT_KO[d.getDay()];

  if (format === "compact") {
    return `${d.getMonth() + 1}/${d.getDate()}(${dayNameKo})`;
  }

  if (format === "tooltip") {
    return `${year}/${month}/${day}(${dayNameKo}) ${hour}:${minute}`;
  }

  if (format === "date") {
    return `${year}-${month}-${day}(${dayName})`;
  }

  if (format === "short") {
    return `${month}-${day}(${dayName}) ${hour}:${minute}`;
  }

  return `${year}-${month}-${day}(${dayName}) ${hour}:${minute}`;
}

/**
 * ISO 문자열을 시스템 타임존 기준 Date로 변환합니다.
 */
export function toLocalDate(isoString: string): Date {
  return new Date(isoString);
}

export function parseDateOnly(date: Date | string): Date {
  if (typeof date === "string") {
    const matched = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matched) {
      return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
    }
  }

  const value = typeof date === "string" ? new Date(date) : date;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function toDateInputValue(date?: Date | string | null): string {
  if (!date) return "";

  if (typeof date === "string") {
    const matched = date.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) return matched[1];
  }

  const value = typeof date === "string" ? new Date(date) : date;
  if (!isValidDate(value)) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
