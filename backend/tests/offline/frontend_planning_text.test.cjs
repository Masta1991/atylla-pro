const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'frontend');
const babel = require(require.resolve('@babel/core', { paths: [frontend] }));
const plugin = require.resolve('@babel/plugin-transform-modules-commonjs', { paths: [frontend] });
const source = fs.readFileSync(path.join(frontend, 'src/services/planningText.js'), 'utf8');
const code = babel.transformSync(source, { plugins: [plugin], configFile: false, babelrc: false }).code;
const context = { exports: {} };
vm.runInNewContext(code, context);
const { patternHistoryText } = context.exports;

assert.equal(
  patternHistoryText({ weekday: 2, observed_days: 6, hits: 4, start_hour: 8, end_hour: 9 }),
  'Analiza objęła 6 śród z co najmniej jednym zapisanym treningiem. W 4 z nich między pierwszym a ostatnim treningiem była wolna przerwa 08:00–09:00.'
);
assert.match(patternHistoryText({ weekday: 2, observed_days: 1, hits: 1, start_hour: 8, end_hour: 9 }), /1 środę/);
assert.match(patternHistoryText({ weekday: 2, observed_days: 2, hits: 1, start_hour: 8, end_hour: 9 }), /2 środy/);
assert.match(patternHistoryText({ weekday: 2, observed_days: 12, hits: 4, start_hour: 8, end_hour: 9 }), /12 śród/);

console.log(JSON.stringify({ scope: 'planning history explanation and Polish day forms', tests: [{ name: 'clear_pattern_denominator_and_day_forms', status: 'PASS' }] }));
