// Patch @eversdk/lib-web for Node (ESM) runtime:
// index.js is built for bundlers/workers and uses module.require / module
// which are unavailable in ESM Node. Replace them with globals.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.resolve(__dirname, '../node_modules/@eversdk/lib-web/index.js');
let s = readFileSync(p, 'utf8');

const old1 = 'const ret = getObject(arg0).require(getStringFromWasm0(arg1, arg2));';
const new1 = 'const ret = (typeof globalThis.__tvmRequire === "function" ? globalThis.__tvmRequire(getStringFromWasm0(arg1, arg2)) : undefined);';
const c1 = s.split(old1).length - 1;
s = s.split(old1).join(new1);

const old2 = 'const ret = module;';
const new2 = 'const ret = globalThis;';
const c2 = s.split(old2).length - 1;
s = s.split(old2).join(new2);

writeFileSync(p, s);
console.log('eversdk patched:', JSON.stringify({ requireShim: c1, moduleAccessor: c2 }));
