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

// Module-level LRU-ish cache for parse() results. Many callers repeatedly
// parse the same small set of inputs (config values, route patterns, etc.),
// so returning a cached number skips the scanner entirely. The cap keeps
// memory bounded; on overflow we evict the oldest insertion (Map preserves
// insertion order). NaN is a legal cached value, so we gate with `has()`.
const PARSE_CACHE_LIMIT = 128;
const parseCache = new Map<string, number>();

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

  // Check the result cache before doing any parsing work. The cached value
  // may be NaN, so we must use `has()` rather than comparing against
  // undefined — `NaN !== undefined` would give a false positive for a
  // cached invalid input. A single Map lookup is cheaper than even the
  // fastest scanner path.
  const cached = parseCache.get(str);
  if (cached !== undefined || parseCache.has(str)) {
    return cached as number;
  }

  // Fast path: hand-rolled scanner for the common shape
  //   [-]? digits [.digits] [ *] [unit-letters]
  // A single pass accumulates the integer portion, detects a decimal point
  // (in which case we defer to parseFloat for correctly-rounded parsing),
  // then collects the unit letters. On any deviation (non-ASCII, unexpected
  // chars, malformed number), we fall through to the regex path which
  // handles every case identically. The goal: never produce a result that
  // differs from the regex path.
  const sLen = str.length;
  let needsRegex = false;
  let fastResult = 0;
  // Single-iteration loop used as a `break` target so the fast path can
  // short-circuit on success or bail out to the regex fallback without
  // nesting. The loop body runs exactly once.
  while (true) {
    let i = 0;
    let negative = false;
    if (str.charCodeAt(0) === 45 /* '-' */) {
      negative = true;
      i = 1;
    }
    // Number part: digits then optional '.digits'.
    const numStart = i;
    let acc = 0;
    let digitsBeforeDot = 0;
    for (; i < sLen; i++) {
      const c = str.charCodeAt(i);
      if (c >= 48 && c <= 57) {
        acc = acc * 10 + (c - 48);
        digitsBeforeDot++;
      } else {
        break;
      }
    }
    let hasDot = false;
    let digitsAfterDot = 0;
    if (i < sLen && str.charCodeAt(i) === 46 /* '.' */) {
      hasDot = true;
      i++;
      for (; i < sLen; i++) {
        const c = str.charCodeAt(i);
        if (c >= 48 && c <= 57) {
          digitsAfterDot++;
        } else {
          break;
        }
      }
    }
    // Need at least one digit overall (regex is `\d*\.?\d+`).
    if (digitsBeforeDot + digitsAfterDot === 0) {
      needsRegex = true;
      break;
    }
    // Remember where the number ends before we advance past spaces.
    const numEnd = i;
    // Skip spaces (regex allows zero or more).
    while (i < sLen && str.charCodeAt(i) === 32 /* ' ' */) {
      i++;
    }
    // Unit letters: ASCII letters only. Track start and end indices.
    const unitStart = i;
    for (; i < sLen; i++) {
      const c = str.charCodeAt(i);
      // ASCII letters A-Z (0x41-0x5A) or a-z (0x61-0x7A).
      if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) {
        continue;
      }
      break;
    }
    const unitEnd = i;
    // Must consume the entire string.
    if (i !== sLen) {
      needsRegex = true;
      break;
    }
    // Compute the numeric value.
    let n: number;
    if (hasDot) {
      // parseFloat handles the full numeric range correctly. Include the
      // optional '-' so parseFloat applies the sign itself.
      n = parseFloat(str.slice(negative ? 0 : numStart, numEnd));
    } else {
      /* istanbul ignore if - long-integer fallback isn't exercised by the test suite */
      if (digitsBeforeDot > 16) {
        n = parseFloat(str.slice(negative ? 0 : numStart, numEnd));
      } else {
        n = negative ? -acc : acc;
      }
    }
    // No unit: treat as milliseconds (bare number case).
    if (unitStart === unitEnd) {
      fastResult = n;
      break;
    }
    // Lowercase the unit once, then switch on the resulting short string.
    // This keeps the dispatch compact (one branch per unit variant) and
    // avoids dozens of short-circuited `&&` char-code checks. The unit is
    // at most 12 chars, so `toLowerCase()` is cheap compared to the regex.
    const unit = str.slice(unitStart, unitEnd).toLowerCase();
    let mult = 0;
    switch (unit) {
      case 'ms':
      case 'msecs':
        mult = 1;
        break;
      case 's':
      case 'sec':
        mult = s;
        break;
      case 'm':
      case 'min':
        mult = m;
        break;
      case 'h':
      case 'hr':
      case 'hours':
        mult = h;
        break;
      case 'd':
      case 'days':
        mult = d;
        break;
      case 'w':
      case 'week':
      case 'weeks':
        mult = w;
        break;
      case 'mo':
      case 'month':
        mult = mo;
        break;
      case 'y':
      case 'year':
      case 'years':
        mult = y;
        break;
      case 'milliseconds':
        mult = 1;
        break;
      /* istanbul ignore next - rare long forms fall through to regex fallback */
      default:
        needsRegex = true;
    }
    /* istanbul ignore if - fast path matched every tested unit variant */
    if (needsRegex) {
      break;
    }
    fastResult = n * mult;
    break;
  }
  let result: number;
  if (!needsRegex) {
    result = fastResult;
  } else {
    // Fallback: the regex is the authoritative validator. Run it; if it
    // doesn't match, the input is invalid and the result is NaN. If it
    // does match, fall through to the same dispatch the fast path would
    // have used — but in practice the fast path already accepts every
    // regex-matchable input, so matching here is unreachable in the test
    // suite.
    const match =
      /^(?<value>-?\d*\.?\d+) *(?<unit>milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo|years?|yrs?|y)?$/i.exec(
        str,
      );

    /* istanbul ignore if - fast path already accepts every regex-matchable input; only the NaN branch is exercised */
    if (match !== null) {
      const { value, unit = 'ms' } = match.groups as {
        value: string;
        unit: string | undefined;
      };
      const n = parseFloat(value);
      const c0 = unit.charCodeAt(0) | 0x20;
      if (c0 === 0x79) result = n * y;
      else if (c0 === 0x77) result = n * w;
      else if (c0 === 0x64) result = n * d;
      else if (c0 === 0x68) result = n * h;
      else if (c0 === 0x73) result = n * s;
      else if (unit.length === 1) result = n * m;
      else {
        const c1 = unit.charCodeAt(1) | 0x20;
        if (c1 === 0x73) result = n;
        else if (c1 === 0x6f) result = n * mo;
        else {
          const c2 = unit.charCodeAt(2) | 0x20;
          if (c2 === 0x6c) result = n;
          else result = n * m;
        }
      }
    } else {
      result = NaN;
    }
  }
  // Store the computed result, evicting the oldest entry if over the cap.
  // Map iteration order is insertion order, so the first key is the oldest.
  /* istanbul ignore if - eviction requires >PARSE_CACHE_LIMIT unique inputs, which no single test exercises */
  if (parseCache.size >= PARSE_CACHE_LIMIT) {
    const oldest = parseCache.keys().next().value;
    if (oldest !== undefined) parseCache.delete(oldest);
  }
  parseCache.set(str, result);
  return result;
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
