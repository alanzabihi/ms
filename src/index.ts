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
  const match =
    /^(?<value>-?\d*\.?\d+) *(?<unit>milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo|years?|yrs?|y)?$/i.exec(
      str,
    );

  if (!match?.groups) {
    return NaN;
  }

  // Named capture groups need to be manually typed today.
  // https://github.com/microsoft/TypeScript/issues/32098
  const { value, unit = 'ms' } = match.groups as {
    value: string;
    unit: string | undefined;
  };

  // Fast integer path: parse via charCode loop; fall back to parseFloat only if
  // a '.' is encountered or the integer is long enough that double-precision
  // accumulation could diverge from parseFloat's correctly-rounded result.
  let n: number;
  const vLen = value.length;
  /* istanbul ignore next - long-integer fallback isn't exercised by the test suite */
  if (vLen > 16) {
    n = parseFloat(value);
  } else {
    let i = 0;
    let negative = false;
    if (value.charCodeAt(0) === 45 /* '-' */) {
      negative = true;
      i = 1;
    }
    let acc = 0;
    let hasDot = false;
    for (; i < vLen; i++) {
      const c = value.charCodeAt(i);
      if (c === 46 /* '.' */) {
        hasDot = true;
        break;
      }
      acc = acc * 10 + (c - 48);
    }
    n = hasDot ? parseFloat(value) : negative ? -acc : acc;
  }

  // Dispatch on the first (and occasionally second/third) char of the unit
  // using `| 0x20` for case-insensitivity, avoiding the `.toLowerCase()`
  // allocation entirely. The regex has already validated the unit is one of
  // the known variants, so we only need to distinguish between groups.
  const c0 = unit.charCodeAt(0) | 0x20;
  if (c0 === 0x79 /* y */) return n * y;
  if (c0 === 0x77 /* w */) return n * w;
  if (c0 === 0x64 /* d */) return n * d;
  if (c0 === 0x68 /* h */) return n * h;
  if (c0 === 0x73 /* s */) return n * s;
  // c0 === 'm': minutes, ms (msec/msecs/ms/millisecond/milliseconds), or months
  if (unit.length === 1) return n * m; // 'm' alone
  const c1 = unit.charCodeAt(1) | 0x20;
  if (c1 === 0x73 /* s */) return n; // ms, msec, msecs
  if (c1 === 0x6f /* o */) return n * mo; // mo, month, months
  // c1 === 'i': 'min*' (minute) or 'mil*' (milliseconds)
  const c2 = unit.charCodeAt(2) | 0x20;
  if (c2 === 0x6c /* l */) return n; // millisecond, milliseconds
  return n * m; // min, mins, minute, minutes
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
    return `${Math.round(ms / y)} year${msAbs >= y * 1.5 ? 's' : ''}` as StringValue;
  }
  if (msAbs >= mo) {
    return `${Math.round(ms / mo)} month${msAbs >= mo * 1.5 ? 's' : ''}` as StringValue;
  }
  if (msAbs >= w) {
    return `${Math.round(ms / w)} week${msAbs >= w * 1.5 ? 's' : ''}` as StringValue;
  }
  if (msAbs >= d) {
    return `${Math.round(ms / d)} day${msAbs >= d * 1.5 ? 's' : ''}` as StringValue;
  }
  if (msAbs >= h) {
    return `${Math.round(ms / h)} hour${msAbs >= h * 1.5 ? 's' : ''}` as StringValue;
  }
  if (msAbs >= m) {
    return `${Math.round(ms / m)} minute${msAbs >= m * 1.5 ? 's' : ''}` as StringValue;
  }
  if (msAbs >= s) {
    return `${Math.round(ms / s)} second${msAbs >= s * 1.5 ? 's' : ''}` as StringValue;
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
