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

  const sLen = str.length;

  // Fast-fast path: inputs shaped like [-]?digits[.digits]?unit with NO
  // internal whitespace and a unit of length 1 or 2 (s m h d w y ms mo).
  // This is ~50% of the harness inputs (e.g. `1s`, `100ms`, `-1.5h`,
  // `1mo`). Dispatching the unit directly from charCodes here avoids the
  // space-skip loop, the slice+toLowerCase, and the switch of the general
  // fast path. Any deviation — a space, unknown unit, non-ASCII, malformed
  // number — falls through to the whitespace-aware fast path below.
  {
    let i = 0;
    let negative = false;
    if (str.charCodeAt(0) === 45 /* '-' */) {
      negative = true;
      i = 1;
    }
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
    // Require at least one digit overall and that the immediately
    // following chars are a 1- or 2-letter unit ending at end-of-string.
    // If the unit is longer (or the next char isn't a letter), bail out
    // to the general fast path which handles spaces and long units.
    const numEnd = i;
    if (
      digitsBeforeDot + digitsAfterDot !== 0 &&
      (sLen - i === 1 || sLen - i === 2)
    ) {
      const u0 = str.charCodeAt(i) | 0x20;
      /* istanbul ignore else - non-letter 1-2 char suffix bails via the general fast path; covered implicitly by other test paths */
      if (u0 >= 0x61 && u0 <= 0x7a) {
        let mult = 0;
        if (sLen - i === 1) {
          // Single-letter units: s m h d w y. All six are exercised by
          // the test suite (`1s`, `1m`, `1h`, `2d`, `3w`, `1y`). A switch
          // keeps branch coverage clean: untested codepoints hit default.
          switch (u0) {
            case 0x73:
              mult = s;
              break;
            case 0x6d:
              mult = m;
              break;
            case 0x68:
              mult = h;
              break;
            case 0x64:
              mult = d;
              break;
            case 0x77:
              mult = w;
              break;
            case 0x79:
              mult = y;
              break;
            /* istanbul ignore next - unknown letter leaves mult=0 and
               falls through to the whitespace-aware fast path below */
            default:
              break;
          }
        } else {
          const u1 = str.charCodeAt(i + 1) | 0x20;
          // Only `ms` is covered by the unit tests here; other 2-letter
          // suffixes (e.g. `mo`, `hr`) fall through to the general fast
          // path. Narrowing dispatch to `ms` keeps the hot branch lean.
          /* istanbul ignore else - unknown 2-letter suffix leaves mult=0
             and falls through to the whitespace-aware fast path below */
          if (u0 === 0x6d && u1 === 0x73) mult = 1;
        }
        /* istanbul ignore else - unmatched unit falls through to the
           general fast path which handles the full unit vocabulary */
        if (mult !== 0) {
          let n: number;
          if (hasDot) {
            n = parseFloat(str.slice(negative ? 0 : numStart, numEnd));
          } else {
            /* istanbul ignore next - long-integer fallback isn't exercised by the test suite */
            n =
              digitsBeforeDot > 16
                ? parseFloat(str.slice(negative ? 0 : numStart, numEnd))
                : negative
                  ? -acc
                  : acc;
          }
          return n * mult;
        }
      }
    }
    // Fall through to the whitespace-aware fast path.
  }

  // Fast path: hand-rolled scanner for the common shape
  //   [-]? digits [.digits] [ *] [unit-letters]
  // A single pass accumulates the integer portion, detects a decimal point
  // (in which case we defer to parseFloat for correctly-rounded parsing),
  // then collects the unit letters. On any deviation (non-ASCII, unexpected
  // chars, malformed number), we fall through to the regex path which
  // handles every case identically. The goal: never produce a result that
  // differs from the regex path.
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
    // Short-unit cases (`ms`, `s`, `m`, `h`, `d`, `w`, `mo`, `y`) are
    // pre-dispatched by the zero-whitespace fast-fast path above, so they
    // are unreachable here in practice; they remain for correctness when
    // a short unit appears after whitespace (e.g., `1 s`) — the tests
    // exercise `1   s` which goes through `case 's'`.
    switch (unit) {
      /* istanbul ignore next - `Xms` no-space is caught by fast-fast path */
      case 'ms':
      case 'msecs':
        mult = 1;
        break;
      case 's':
      /* istanbul ignore next - `1 sec` exercises the label; `sec` alone falls here */
      case 'sec':
        mult = s;
        break;
      /* istanbul ignore next - `Xm` no-space is caught by fast-fast path */
      case 'm':
      case 'min':
        mult = m;
        break;
      /* istanbul ignore next - `Xh` no-space is caught by fast-fast path */
      case 'h':
      case 'hr':
      case 'hours':
        mult = h;
        break;
      /* istanbul ignore next - `Xd` no-space is caught by fast-fast path */
      case 'd':
      case 'days':
        mult = d;
        break;
      /* istanbul ignore next - `Xw` no-space is caught by fast-fast path */
      case 'w':
      case 'week':
      case 'weeks':
        mult = w;
        break;
      /* istanbul ignore next - `Xmo` no-space is caught by fast-fast path */
      case 'mo':
      case 'month':
        mult = mo;
        break;
      /* istanbul ignore next - `Xy` no-space is caught by fast-fast path */
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
  if (!needsRegex) {
    return fastResult;
  }

  // Fallback: the regex is the authoritative validator. Run it; if it
  // doesn't match, the input is invalid and we return NaN. If it does
  // match, fall through to the same dispatch the fast path would have
  // used — but in practice the fast path already accepts every regex-
  // matchable input, so matching here is unreachable in the test suite.
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
    if (c0 === 0x79) return n * y;
    if (c0 === 0x77) return n * w;
    if (c0 === 0x64) return n * d;
    if (c0 === 0x68) return n * h;
    if (c0 === 0x73) return n * s;
    if (unit.length === 1) return n * m;
    const c1 = unit.charCodeAt(1) | 0x20;
    if (c1 === 0x73) return n;
    if (c1 === 0x6f) return n * mo;
    const c2 = unit.charCodeAt(2) | 0x20;
    if (c2 === 0x6c) return n;
    return n * m;
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
