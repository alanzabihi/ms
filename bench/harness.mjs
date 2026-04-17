import { createHash } from 'node:crypto';
import { parse, format } from '../dist/index.js';

const ITERS = 2_000_000;
const WARMUP = 200_000;
const ROUNDS = 5;

const parseInputs = [
  '100', '1s', '1m', '1h', '2d', '3w', '1y', '1mo',
  '1.5h', '-100ms', '.5ms', '-.5h', '-1.5h', '-10.5h',
  '53 milliseconds', '17 msecs', '1 sec', '1 min', '1 hr',
  '2 days', '1 week', '1 month', '1 year', '1.5 hours',
  '-100 milliseconds', '-1.5 hours', '100ms', '1 minute',
  '1 hour', '1 day',
];

const formatInputs = [
  500, -500, 1000, 10000, 60000, 600000, 3600000, 36000000,
  86400000, 518400000, 604800000, 1209600000,
  2629800000, -2629800000,
  31557600001, -31557600001, 234234234, -234234234,
];

const longOpt = { long: true };
const pLen = parseInputs.length;
const fLen = formatInputs.length;

function fp(label, values) {
  const h = createHash('sha256');
  for (const v of values) h.update(String(v));
  return `${label}:${h.digest('hex').slice(0, 16)}`;
}

function median(times) {
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

function benchParse() {
  const results = [];
  for (let i = 0; i < pLen; i++) results.push(parse(parseInputs[i]));

  for (let i = 0; i < WARMUP; i++) parse(parseInputs[i % pLen]);

  const times = [];
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = performance.now();
    for (let i = 0; i < ITERS; i++) parse(parseInputs[i % pLen]);
    times.push(performance.now() - t0);
  }

  return { ms: median(times), fp: fp('parse', results) };
}

function benchFormat() {
  const results = [];
  for (let i = 0; i < fLen; i++) {
    results.push(format(formatInputs[i]));
    results.push(format(formatInputs[i], longOpt));
  }

  for (let i = 0; i < WARMUP; i++) format(formatInputs[i % fLen]);

  const times = [];
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = performance.now();
    for (let i = 0; i < ITERS; i++) {
      if (i & 1) format(formatInputs[(i >> 1) % fLen], longOpt);
      else format(formatInputs[(i >> 1) % fLen]);
    }
    times.push(performance.now() - t0);
  }

  return { ms: median(times), fp: fp('format', results) };
}

const p = benchParse();
const f = benchFormat();

console.log(`parse_ms\t${p.ms.toFixed(2)}`);
console.log(`format_ms\t${f.ms.toFixed(2)}`);
console.log(`parse_fp\t${p.fp}`);
console.log(`format_fp\t${f.fp}`);
