// Builds dist/index.html: the whole game as one self-contained page (CSS and JS inlined).
// Usage: npm run build   (or: node build.mjs)
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const tpl = read('src/index.html');
const css = read('src/style.css');
// every file in src/js, in name order (the number prefixes set the order)
const files = fs.readdirSync(path.join(root, 'src/js')).filter((f) => f.endsWith('.js')).sort();
const js = files.map((f) => `// ===== ${f} =====\n` + read('src/js/' + f)).join('\n');
const bundle = `(function(){'use strict';\n${js}\n})();`;

// fail the build on a syntax error instead of shipping a broken page
try { new vm.Script(bundle, { filename: 'bundle.js' }); } catch (e) {
  console.error('Build failed: syntax error in the game code\n', e.message);
  process.exit(1);
}

const out = tpl.replace('/*__STYLE__*/', () => css).replace('/*__SCRIPT__*/', () => bundle);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), out);
console.log('built dist/index.html', (out.length / 1024).toFixed(1) + ' KB from', files.length, 'modules');
