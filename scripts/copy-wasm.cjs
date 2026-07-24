/**
 * copy-wasm.cjs
 *
 * Копирует eversdk.wasm из node_modules/@eversdk/lib-web в public/.
 * Нужен для работы @eversdk/lib-web в браузере.
 *
 * Вызывается из package.json: npm run copy:wasm
 * Запускается автоматически перед build.
 *
 * Использует .cjs расширение, т.к. package.json имеет "type": "module".
 */

const fs = require('fs');
const path = require('path');

const src = path.join(
  __dirname,
  '..',
  'node_modules',
  '@eversdk',
  'lib-web',
  'eversdk.wasm',
);
const dest = path.join(__dirname, '..', 'public', 'eversdk.wasm');

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log('[copy-wasm] WASM copied to public/eversdk.wasm');
} else {
  console.warn('[copy-wasm] WASM not found at ' + src);
  console.warn(
    '[copy-wasm] Run "npm install @eversdk/lib-web" first',
  );
}
