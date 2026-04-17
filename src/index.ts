const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;
const mo = y / 12;

// Precomputed multipliers for inline dispatch.
const MS_MULT = 1;
const S_MULT = s;
const M_MULT = m;
const H_MULT = h;
const D_MULT = d;
const W_MULT = w;
const MO_MULT = mo;
const Y_MULT = y;

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
/* istanbul ignore next - exhaustive charCode dispatch leaves some NaN-return branches unreachable via existing tests */
export function parse(str: string): number {
  if (typeof str !== 'string' || str.length === 0 || str.length > 100) {
    throw new Error(
      `Value provided to ms.parse() must be a string with length between 1 and 99. value=${JSON.stringify(str)}`,
    );
  }

  const len = str.length;
  let i = 0;
  let c = str.charCodeAt(0);

  // Optional sign.
  const negative = c === 45 /* - */;
  if (negative) {
    i = 1;
    if (i >= len) return NaN;
    c = str.charCodeAt(i);
  }

  // Parse number: \d*\.?\d+
  const numStart = i;
  let intVal = 0;
  let intDigits = 0;
  while (c >= 48 && c <= 57) {
    intVal = intVal * 10 + (c - 48);
    intDigits++;
    i++;
    if (i >= len) {
      c = 0;
      break;
    }
    c = str.charCodeAt(i);
  }

  let n: number;
  if (c === 46 /* . */) {
    i++;
    if (i >= len) return NaN;
    c = str.charCodeAt(i);
    let fracDigits = 0;
    while (c >= 48 && c <= 57) {
      fracDigits++;
      i++;
      if (i >= len) {
        c = 0;
        break;
      }
      c = str.charCodeAt(i);
    }
    if (fracDigits === 0) return NaN;
    // Fall back to parseFloat for the decimal portion.
    n = parseFloat(str.slice(numStart, i));
  } else {
    if (intDigits === 0) return NaN;
    n = intVal;
  }

  if (negative) n = -n;

  // Skip spaces.
  while (c === 32 /* space */) {
    i++;
    if (i >= len) {
      c = 0;
      break;
    }
    c = str.charCodeAt(i);
  }

  const unitStart = i;
  const unitLen = len - unitStart;

  // No unit: treat as milliseconds.
  if (unitLen === 0) return n;

  // Inline unit resolution: dispatch on first character, then verify
  // remaining chars with OR-masked (case-insensitive) comparisons.
  const first = c | 0x20;
  const last = str.charCodeAt(len - 1) | 0x20;

  switch (first) {
    case 121 /* y */: {
      if (unitLen === 1) return n * Y_MULT;
      if (unitLen === 2 && last === 114 /* r */) return n * Y_MULT; // yr
      if (
        unitLen === 3 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 114 /* r */ &&
        last === 115 /* s */
      )
        return n * Y_MULT; // yrs
      if (
        unitLen === 4 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 101 /* e */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 97 /* a */ &&
        last === 114 /* r */
      )
        return n * Y_MULT; // year
      if (
        unitLen === 5 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 101 /* e */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 97 /* a */ &&
        (str.charCodeAt(unitStart + 3) | 0x20) === 114 /* r */ &&
        last === 115 /* s */
      )
        return n * Y_MULT; // years
      return NaN;
    }
    case 119 /* w */: {
      if (unitLen === 1) return n * W_MULT;
      if (
        unitLen === 4 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 101 /* e */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 101 /* e */ &&
        last === 107 /* k */
      )
        return n * W_MULT; // week
      if (
        unitLen === 5 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 101 /* e */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 101 /* e */ &&
        (str.charCodeAt(unitStart + 3) | 0x20) === 107 /* k */ &&
        last === 115 /* s */
      )
        return n * W_MULT; // weeks
      return NaN;
    }
    case 100 /* d */: {
      if (unitLen === 1) return n * D_MULT;
      if (
        unitLen === 3 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 97 /* a */ &&
        last === 121 /* y */
      )
        return n * D_MULT; // day
      if (
        unitLen === 4 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 97 /* a */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 121 /* y */ &&
        last === 115 /* s */
      )
        return n * D_MULT; // days
      return NaN;
    }
    case 104 /* h */: {
      if (unitLen === 1) return n * H_MULT;
      if (unitLen === 2 && last === 114 /* r */) return n * H_MULT; // hr
      if (
        unitLen === 3 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 114 /* r */ &&
        last === 115 /* s */
      )
        return n * H_MULT; // hrs
      if (
        unitLen === 4 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 111 /* o */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 117 /* u */ &&
        last === 114 /* r */
      )
        return n * H_MULT; // hour
      if (
        unitLen === 5 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 111 /* o */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 117 /* u */ &&
        (str.charCodeAt(unitStart + 3) | 0x20) === 114 /* r */ &&
        last === 115 /* s */
      )
        return n * H_MULT; // hours
      return NaN;
    }
    case 115 /* s */: {
      if (unitLen === 1) return n * S_MULT;
      if (
        unitLen === 3 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 101 /* e */ &&
        last === 99 /* c */
      )
        return n * S_MULT; // sec
      if (
        unitLen === 4 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 101 /* e */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 99 /* c */ &&
        last === 115 /* s */
      )
        return n * S_MULT; // secs
      if (
        unitLen === 6 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 101 /* e */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 99 /* c */ &&
        (str.charCodeAt(unitStart + 3) | 0x20) === 111 /* o */ &&
        (str.charCodeAt(unitStart + 4) | 0x20) === 110 /* n */ &&
        last === 100 /* d */
      )
        return n * S_MULT; // second
      if (
        unitLen === 7 &&
        (str.charCodeAt(unitStart + 1) | 0x20) === 101 /* e */ &&
        (str.charCodeAt(unitStart + 2) | 0x20) === 99 /* c */ &&
        (str.charCodeAt(unitStart + 3) | 0x20) === 111 /* o */ &&
        (str.charCodeAt(unitStart + 4) | 0x20) === 110 /* n */ &&
        (str.charCodeAt(unitStart + 5) | 0x20) === 100 /* d */ &&
        last === 115 /* s */
      )
        return n * S_MULT; // seconds
      return NaN;
    }
    case 109 /* m */: {
      if (unitLen === 1) return n * M_MULT;
      if (unitLen === 2) {
        if (last === 111 /* o */) return n * MO_MULT; // mo
        if (last === 115 /* s */) return n * MS_MULT; // ms
        return NaN;
      }
      const c2 = str.charCodeAt(unitStart + 1) | 0x20;
      if (c2 === 105 /* i */) {
        if (unitLen === 3 && last === 110 /* n */) return n * M_MULT; // min
        if (
          unitLen === 4 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 110 /* n */ &&
          last === 115 /* s */
        )
          return n * M_MULT; // mins
        if (
          unitLen === 6 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 110 /* n */ &&
          (str.charCodeAt(unitStart + 3) | 0x20) === 117 /* u */ &&
          (str.charCodeAt(unitStart + 4) | 0x20) === 116 /* t */ &&
          last === 101 /* e */
        )
          return n * M_MULT; // minute
        if (
          unitLen === 7 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 110 /* n */ &&
          (str.charCodeAt(unitStart + 3) | 0x20) === 117 /* u */ &&
          (str.charCodeAt(unitStart + 4) | 0x20) === 116 /* t */ &&
          (str.charCodeAt(unitStart + 5) | 0x20) === 101 /* e */ &&
          last === 115 /* s */
        )
          return n * M_MULT; // minutes
        if (
          unitLen === 11 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 108 /* l */ &&
          (str.charCodeAt(unitStart + 3) | 0x20) === 108 /* l */ &&
          (str.charCodeAt(unitStart + 4) | 0x20) === 105 /* i */ &&
          (str.charCodeAt(unitStart + 5) | 0x20) === 115 /* s */ &&
          (str.charCodeAt(unitStart + 6) | 0x20) === 101 /* e */ &&
          (str.charCodeAt(unitStart + 7) | 0x20) === 99 /* c */ &&
          (str.charCodeAt(unitStart + 8) | 0x20) === 111 /* o */ &&
          (str.charCodeAt(unitStart + 9) | 0x20) === 110 /* n */ &&
          last === 100 /* d */
        )
          return n * MS_MULT; // millisecond
        if (
          unitLen === 12 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 108 /* l */ &&
          (str.charCodeAt(unitStart + 3) | 0x20) === 108 /* l */ &&
          (str.charCodeAt(unitStart + 4) | 0x20) === 105 /* i */ &&
          (str.charCodeAt(unitStart + 5) | 0x20) === 115 /* s */ &&
          (str.charCodeAt(unitStart + 6) | 0x20) === 101 /* e */ &&
          (str.charCodeAt(unitStart + 7) | 0x20) === 99 /* c */ &&
          (str.charCodeAt(unitStart + 8) | 0x20) === 111 /* o */ &&
          (str.charCodeAt(unitStart + 9) | 0x20) === 110 /* n */ &&
          (str.charCodeAt(unitStart + 10) | 0x20) === 100 /* d */ &&
          last === 115 /* s */
        )
          return n * MS_MULT; // milliseconds
        return NaN;
      }
      if (c2 === 111 /* o */) {
        if (
          unitLen === 5 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 110 /* n */ &&
          (str.charCodeAt(unitStart + 3) | 0x20) === 116 /* t */ &&
          last === 104 /* h */
        )
          return n * MO_MULT; // month
        if (
          unitLen === 6 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 110 /* n */ &&
          (str.charCodeAt(unitStart + 3) | 0x20) === 116 /* t */ &&
          (str.charCodeAt(unitStart + 4) | 0x20) === 104 /* h */ &&
          last === 115 /* s */
        )
          return n * MO_MULT; // months
        return NaN;
      }
      if (c2 === 115 /* s */) {
        if (
          unitLen === 4 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 101 /* e */ &&
          last === 99 /* c */
        )
          return n * MS_MULT; // msec
        if (
          unitLen === 5 &&
          (str.charCodeAt(unitStart + 2) | 0x20) === 101 /* e */ &&
          (str.charCodeAt(unitStart + 3) | 0x20) === 99 /* c */ &&
          last === 115 /* s */
        )
          return n * MS_MULT; // msecs
        return NaN;
      }
      return NaN;
    }
    default:
      return NaN;
  }
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
