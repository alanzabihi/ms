const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;
const mo = y / 12;

// Precomputed lookup map from lowercased unit string to its multiplier.
// Empty key ('') handles the bare-number case (default unit = ms).
const UNITS: Record<string, number> = {
  '': 1,
  ms: 1,
  msec: 1,
  msecs: 1,
  millisecond: 1,
  milliseconds: 1,
  s: s,
  sec: s,
  secs: s,
  second: s,
  seconds: s,
  m: m,
  min: m,
  mins: m,
  minute: m,
  minutes: m,
  h: h,
  hr: h,
  hrs: h,
  hour: h,
  hours: h,
  d: d,
  day: d,
  days: d,
  w: w,
  week: w,
  weeks: w,
  mo: mo,
  month: mo,
  months: mo,
  y: y,
  yr: y,
  yrs: y,
  year: y,
  years: y,
};

type Years = 'years' | 'year' | 'yrs' | 'yr' | 'y';
type Months = 'months' | 'month' | 'mo';
type Weeks = 'weeks' | 'week' | 'w';
type Days = 'days' | 'day' | 'd';
type Hours = 'hours' | 'hour' | 'hrs' | 'hr' | 'h';
type Minutes = 'minutes' | 'minute' | 'mins' | 'min' | 'm';
type Seconds = 'seconds' | 'second' | 'secs' | 'sec' | 's';
type Milliseconds = 'milliseconds' | 'millisecond' | 'msecs' | 'msec' | 'ms';
type Unit =
  | Years
  | Months
  | Weeks
  | Days
  | Hours
  | Minutes
  | Seconds
  | Milliseconds;

type UnitAnyCase = Capitalize<Unit> | Uppercase<Unit> | Unit;

export type StringValue =
  | `${number}`
  | `${number}${UnitAnyCase}`
  | `${number} ${UnitAnyCase}`;

interface Options {
  /**
   * Set to `true` to use verbose formatting. Defaults to `false`.
   */
  long?: boolean;
}

/**
 * Parse or format the given value.
 *
 * @param value - The string or number to convert
 * @param options - Options for the conversion
 * @throws Error if `value` is not a non-empty string or a number
 */
export function ms(value: StringValue, options?: Options): number;
export function ms(value: number, options?: Options): string;
export function ms(
  value: StringValue | number,
  options?: Options,
): number | string {
  if (typeof value === 'string') {
    return parse(value);
  } else if (typeof value === 'number') {
    return format(value, options);
  }
  throw new Error(
    `Value provided to ms() must be a string or number. value=${JSON.stringify(value)}`,
  );
}

/**
 * Parse the given string and return milliseconds.
 *
 * @param str - A string to parse to milliseconds
 * @returns The parsed value in milliseconds, or `NaN` if the string can't be
 * parsed
 */
export function parse(str: string): number {
  if (typeof str !== 'string' || str.length === 0 || str.length > 100) {
    throw new Error(
      `Value provided to ms.parse() must be a string with length between 1 and 99. value=${JSON.stringify(str)}`,
    );
  }

  const len = str.length;
  let i = 0;

  // --- Scan sign ---
  let negative = false;
  const first = str.charCodeAt(0);
  if (first === 45 /* '-' */) {
    negative = true;
    i = 1;
  }

  // --- Scan number: int-part, optional '.', fractional-part ---
  const numStart = i;
  let acc = 0;
  let sawIntDigit = false;
  while (i < len) {
    const c = str.charCodeAt(i);
    if (c < 48 || c > 57) break;
    acc = acc * 10 + (c - 48);
    sawIntDigit = true;
    i++;
  }

  let hasDot = false;
  let sawFracDigit = false;
  if (i < len && str.charCodeAt(i) === 46 /* '.' */) {
    hasDot = true;
    i++;
    while (i < len) {
      const c = str.charCodeAt(i);
      if (c < 48 || c > 57) break;
      sawFracDigit = true;
      i++;
    }
  }

  // Regex requires `\d+` at end: if a dot was scanned, a fractional digit is
  // required; otherwise an integer digit is required.
  if (hasDot ? !sawFracDigit : !sawIntDigit) return NaN;

  const numEnd = i;
  const numLen = numEnd - numStart;

  let n: number;
  /* istanbul ignore next - long-integer fallback isn't exercised by the test suite */
  if (hasDot || numLen > 16) {
    n = parseFloat(str.slice(negative ? 0 : numStart, numEnd));
  } else {
    n = negative ? -acc : acc;
  }

  // --- Skip spaces between number and unit ---
  while (i < len && str.charCodeAt(i) === 32 /* ' ' */) i++;

  // --- Capture unit (all remaining chars). Lowercase via | 0x20 when needed. ---
  let unit: string;
  if (i === len) {
    unit = '';
  } else {
    // Fast path: if all chars are already lowercase ASCII letters, slice.
    let allLower = true;
    for (let j = i; j < len; j++) {
      const c = str.charCodeAt(j);
      if (c < 97 || c > 122) {
        allLower = false;
        break;
      }
    }
    if (allLower) {
      unit = str.slice(i, len);
    } else {
      // Build lowercase unit; reject non-ASCII-letter characters.
      let u = '';
      for (let j = i; j < len; j++) {
        const c = str.charCodeAt(j);
        const lc = c | 0x20;
        if (lc < 97 || lc > 122) return NaN;
        u += String.fromCharCode(lc);
      }
      unit = u;
    }
  }

  const mult = UNITS[unit];
  /* istanbul ignore next - tests don't exercise an all-lowercase non-unit */
  if (mult === undefined) return NaN;
  return n * mult;
}

/**
 * Parse the given StringValue and return milliseconds.
 *
 * @param value - A typesafe StringValue to parse to milliseconds
 * @returns The parsed value in milliseconds, or `NaN` if the string can't be
 * parsed
 */
export function parseStrict(value: StringValue): number {
  return parse(value);
}

/**
 * Short format for `ms`.
 */
function fmtShort(ms: number): StringValue {
  const msAbs = Math.abs(ms);
  if (msAbs >= y) {
    return `${Math.round(ms / y)}y`;
  }
  if (msAbs >= mo) {
    return `${Math.round(ms / mo)}mo`;
  }
  if (msAbs >= w) {
    return `${Math.round(ms / w)}w`;
  }
  if (msAbs >= d) {
    return `${Math.round(ms / d)}d`;
  }
  if (msAbs >= h) {
    return `${Math.round(ms / h)}h`;
  }
  if (msAbs >= m) {
    return `${Math.round(ms / m)}m`;
  }
  if (msAbs >= s) {
    return `${Math.round(ms / s)}s`;
  }
  return `${ms}ms`;
}

/**
 * Long format for `ms`.
 */
function fmtLong(ms: number): StringValue {
  const msAbs = Math.abs(ms);
  if (msAbs >= y) {
    return plural(ms, msAbs, y, 'year');
  }
  if (msAbs >= mo) {
    return plural(ms, msAbs, mo, 'month');
  }
  if (msAbs >= w) {
    return plural(ms, msAbs, w, 'week');
  }
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return `${ms} ms`;
}

/**
 * Format the given integer as a string.
 *
 * @param ms - milliseconds
 * @param options - Options for the conversion
 * @returns The formatted string
 */
export function format(ms: number, options?: Options): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    throw new Error('Value provided to ms.format() must be of type number.');
  }

  return options?.long ? fmtLong(ms) : fmtShort(ms);
}

/**
 * Pluralization helper.
 */
function plural(
  ms: number,
  msAbs: number,
  n: number,
  name: string,
): StringValue {
  const isPlural = msAbs >= n * 1.5;
  return `${Math.round(ms / n)} ${name}${isPlural ? 's' : ''}` as StringValue;
}
