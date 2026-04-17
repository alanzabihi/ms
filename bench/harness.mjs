import { parse, format } from '../dist/index.js';
import { createHash } from 'node:crypto';

const PARSE_ITERS = 2_000_000;
const FORMAT_ITERS = 2_000_000;
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

function fingerprint(label, fn, inputs, len) {
  const h = createHash('sha256');
  for (let i = 0; i < len; i++) {
    h.update(String(fn(inputs[i % inputs.length])));
  }
  const digest = h.digest('hex').slice(0, 16);
  console.log(`${label}_fingerprint=${digest}`);
  return digest;
}

function benchParse() {
  for (let i = 0; i < WARMUP; i++) parse(parseInputs[i % pLen]);

  const times = [];
  for (let r = 0; r < ROUNDS; r++) {
    const start = performance.now();
    for (let i = 0; i < PARSE_ITERS; i++) parse(parseInputs[i % pLen]);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(ROUNDS / 2)];
}

function benchFormat() {
  for (let i = 0; i < WARMUP; i++) format(formatInputs[i % fLen]);

  const times = [];
  for (let r = 0; r < ROUNDS; r++) {
    const start = performance.now();
    for (let i = 0; i < FORMAT_ITERS; i++) {
      if (i & 1) format(formatInputs[(i >> 1) % fLen], longOpt);
      else format(formatInputs[(i >> 1) % fLen]);
    }
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(ROUNDS / 2)];
}

const parseFP = fingerprint('parse', parse, parseInputs, 10000);
const formatFP = fingerprint('format',
  (v) => format(v) + '|' + format(v, longOpt),
  formatInputs, 10000);

const parseMs = benchParse();
const formatMs = benchFormat();

console.log(`parse_ms=${parseMs.toFixed(2)}`);
console.log(`format_ms=${formatMs.toFixed(2)}`);
console.log(`parse_ns_per_call=${(parseMs * 1e6 / PARSE_ITERS).toFixed(1)}`);
console.log(`format_ns_per_call=${(formatMs * 1e6 / FORMAT_ITERS).toFixed(1)}`);
