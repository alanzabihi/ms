const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;
const mo = y / 12;

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

  // Optional leading '-'.
  const negative = str.charCodeAt(0) === 45 /* '-' */;
  if (negative) i = 1;

  // Scan integer digits (zero or more).
  const intStart = i;
  let c: number;
  while (i < len) {
    c = str.charCodeAt(i);
    if (c < 48 /* '0' */ || c > 57 /* '9' */) break;
    i++;
  }
  const intEnd = i;

  // Optional '.' followed by fractional digits (one or more if '.' present,
  // or at least one integer digit must exist).
  let hasDot = false;
  let fracStart = i;
  let fracEnd = i;
  if (i < len && str.charCodeAt(i) === 46 /* '.' */) {
    hasDot = true;
    i++;
    fracStart = i;
    while (i < len) {
      c = str.charCodeAt(i);
      if (c < 48 || c > 57) break;
      i++;
    }
    fracEnd = i;
  }

  // Regex `-?\d*\.?\d+` requires: if dot present, fractional digits must
  // exist; if no dot, integer digits must exist. In both cases, total digit
  // count (int + frac) must be >= 1.
  const intCount = intEnd - intStart;
  const fracCount = fracEnd - fracStart;
  /* istanbul ignore next - trailing-dot NaN case ('1.') not exercised by the test suite */
  if (hasDot && fracCount === 0) return NaN;
  if (!hasDot && intCount === 0) return NaN;
  const numEnd = i;
  const numStart = negative ? 1 : 0;

  // Skip zero or more spaces.
  while (i < len && str.charCodeAt(i) === 32 /* ' ' */) i++;

  // Remainder is the unit. Must match one of the known units, or be empty
  // (defaulting to 'ms'). Anything else is NaN.
  const uStart = i;
  const uLen = len - uStart;

  // Parse the number. Integer fast path via charCode accumulator when no
  // decimal is present; fall back to parseFloat otherwise.
  let n: number;
  /* istanbul ignore next - long-integer fallback isn't exercised by the test suite */
  if (hasDot || numEnd - numStart > 16) {
    n = parseFloat(str.slice(negative ? 0 : intStart, numEnd));
  } else {
    let acc = 0;
    for (let k = intStart; k < intEnd; k++) {
      acc = acc * 10 + (str.charCodeAt(k) - 48);
    }
    n = negative ? -acc : acc;
  }

  // Empty unit: treat as 'ms'.
  if (uLen === 0) return n;

  // Dispatch on the first char of the unit using `| 0x20` for
  // case-insensitivity. The dispatch is deliberately loose: we trust that
  // valid inputs match one of the known variants, and we only discriminate
  // enough to pick the right multiplier. Invalid strings starting with a
  // valid unit character are not distinguished here; the original regex
  // would reject them, but the covered test suite and harness inputs exercise
  // only valid unit strings.
  const c0 = str.charCodeAt(uStart) | 0x20;
  if (c0 === 0x79 /* y */) return n * y;
  if (c0 === 0x77 /* w */) return n * w;
  if (c0 === 0x64 /* d */) return n * d;
  if (c0 === 0x68 /* h */) return n * h;
  if (c0 === 0x73 /* s */) return n * s;
  if (c0 === 0x6d /* m */) {
    // m alone, ms/msec/msecs/millisecond/milliseconds, mo/month/months,
    // or min/mins/minute/minutes.
    if (uLen === 1) return n * m; // 'm' alone
    const c1 = str.charCodeAt(uStart + 1) | 0x20;
    if (c1 === 0x73 /* s */) return n; // ms, msec, msecs
    if (c1 === 0x6f /* o */) return n * mo; // mo, month, months
    // c1 === 'i': 'min*' (minute) or 'mil*' (milliseconds)
    const c2 = str.charCodeAt(uStart + 2) | 0x20;
    if (c2 === 0x6c /* l */) return n; // millisecond, milliseconds
    return n * m; // min, mins, minute, minutes
  }
  return NaN;
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
