// Offline syntax verification using the project's installed Babel parser.
const fs = require('fs');
const path = require('path');
const frontend = path.resolve(__dirname, '../frontend');
const parser = require(require.resolve('@babel/parser', { paths: [frontend] }));
let count = 0;
function parse(file) {
  parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'unambiguous', plugins: ['jsx'] });
  count++;
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.js')) parse(file);
  }
}
walk(path.join(frontend, 'src'));
for (const name of ['App.js', 'index.js']) {
  const file = path.join(frontend, name);
  if (fs.existsSync(file)) parse(file);
}
console.log(JSON.stringify({ status: 'PASS', parsed_modules: count }));
