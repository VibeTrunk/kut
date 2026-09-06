// Design-only asset export. Uses the real KUT component and stylesheet.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const cache = new Map();
function sourceModule(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const compiledModule = { exports: {} }; cache.set(filename, compiledModule.exports);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const localRequire = name => {
    if (!name.startsWith('@/')) return require(name);
    const base = path.join(root, 'src', name.slice(2));
    const target = ['.tsx', '.ts'].map(ext => base + ext).find(f => fs.existsSync(f));
    if (!target) throw new Error(`Missing design source ${name}`);
    return sourceModule(target);
  };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(localRequire, compiledModule, compiledModule.exports);
  cache.set(filename, compiledModule.exports); return compiledModule.exports;
}
const { LiveCard } = sourceModule(path.join(root, 'src/components/live-card.tsx'));
const icons = sourceModule(path.join(root, 'src/components/icons.tsx'));
const players = [
  ['alex','Alex Example',60,'gold'], ['bea','Bea Test',55,'silver'],
  ['charlie','Charlie Fixture',60,'gold'], ['dana','Dana Demo',47,'bronze'],
  ['ellis','Ellis Sample',72,'holo'], ['frankie','Frankie Practice',36,'common']
].map(([id,displayName,liveOvr,rarityTier]) => ({id,displayName,liveOvr,rarityTier,archetype:'all_rounder',pac:liveOvr,sho:liveOvr,pas:liveOvr,dri:liveOvr,def:liveOvr,phy:liveOvr}));
let occurrence = 0;
const cards = Object.fromEntries(players.map(p => [p.id,renderToStaticMarkup(React.createElement(LiveCard,{player:{...p,id:`${p.id}-${++occurrence}`}}))]));
const renderedIcons = Object.fromEntries(Object.entries(icons).map(([name,component]) => [name,renderToStaticMarkup(React.createElement(component))]));
fs.mkdirSync(path.join(here,'assets'), {recursive:true});
fs.writeFileSync(path.join(here,'assets/data.js'), `// Generated from KUT LiveCard and icons; fictional fixtures.\nwindow.KUT_DESIGN = ${JSON.stringify({players,cards,icons:renderedIcons})};\n`);
let css = fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace('@import "tailwindcss";','').replace('@theme inline {',':root {');
fs.writeFileSync(path.join(here,'assets/kut.css'),css);
for(const [source,dest] of [
  ['75affa71d1e2f6a7-s.p.17-aodiw50953.woff2','archivo.woff2'],
  ['e41d5df559864f9e-s.p.1g73gv09-xcb6.woff2','instrument-serif.woff2']
]) fs.copyFileSync(path.join(root,'.next/static/media',source),path.join(here,'assets',dest));
console.log('Exported actual LiveCard markup, icons, global CSS and locally cached KUT fonts.');
