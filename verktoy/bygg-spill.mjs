#!/usr/bin/env node
// Bygger minispillene som frittstående sider fra kildekoden til spillsamlingen.
//   node verktoy/bygg-spill.mjs <sti til kildemappa>
// Skriver spill/nv.js og spill/nv.css (felles for alle spill, caches av nettleseren),
// spill/<id>.html (én side per spill), spill/spill.json (katalogen bygg.mjs leser) og fonts/.
// Bare det minispillene trenger tas med, og alt minifiseres med esbuild så ingen kommentarer følger med.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ut = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) { console.error('Oppgi stien: node verktoy/bygg-spill.mjs <sti til kildemappa>'); process.exit(1); }
const kilde = resolve(process.argv[2]);
const src = join(kilde, 'src');
if (!existsSync(join(src, 'minigames'))) {
  console.error('Fant ikke src/minigames i ' + kilde);
  process.exit(1);
}

// Regionene i kildekoden tilsvarer temaene. Regioner som ikke står her, tas ikke med.
const TEMA = { energi: 'energi', stoffer: 'stoffer', liv: 'liv', jorda: 'jorda', kropp: 'kropp',
  teknologi: 'teknologi', praksis: 'praksis' };
const TEMANAVN = { energi: 'Energi', stoffer: 'Stoffer', liv: 'Livet på jorda', jorda: 'Jorda og universet',
  kropp: 'Kropp og helse', teknologi: 'Teknologi', praksis: 'Praksiser' };

function filer(dir, ext) {
  const p = join(src, dir);
  if (!existsSync(p)) return [];
  const out = [];
  for (const f of readdirSync(p).sort()) {
    const full = join(p, f);
    if (statSync(full).isDirectory()) out.push(...filer(join(dir, f), ext));
    else if (f.endsWith(ext)) out.push(full);
  }
  return out;
}

const regionAv = (f) => (readFileSync(f, 'utf8').match(/region:\s*['"]([a-z]+)['"]/) || [])[1];
const spillfiler = filer('minigames', '.js').filter((f) => TEMA[regionAv(f)]);
// Tekst som skrives om for siden. Plantedøgnet bygger på grubletegningen «Puster planter?» (© Millgate House),
// så tittelen og de tre utsagnene derfra er formulert på nytt. Byggingen stopper hvis en tekst ikke finnes,
// så en endring i kildekoden ikke slipper gjennom uskrevet.
const OMSKRIV = {
  'plantedognet.js': [
    ["header('Puster planter?', `Grubletegning ${i + 1}/${list.length}`)", "header('Hvem har rett?', `Påstand ${i + 1}/${list.length}`)"],
    ["header('Puster planter? Ja — hele tiden', null)", "header('Celleåndingen går hele tiden', null)"],
    ["notes.push('grubletegning: ' + s.id)", "notes.push('påstand: ' + s.id)"],
    ["'Planter har ikke celleånding — de har fotosyntese i stedet.'", "'Celleånding er noe dyr har. Planter klarer seg med fotosyntesen.'"],
    ["'Planter driver fotosyntese om dagen og celleånding om natta.'", "'Om dagen jobber planta med fotosyntese, og om natta bytter den over til celleånding.'"],
    ["'Planter produserer oksygen om dagen og karbondioksid om natta.'", "'Planta produserer O₂ når sola skinner, og CO₂ når det er mørkt.'"],
  ],
};
function les(f) {
  let s = readFileSync(f, 'utf8');
  for (const [fra, til] of OMSKRIV[f.split('/').pop()] || []) {
    if (!s.includes(fra)) throw new Error('Fant ikke teksten som skal skrives om i ' + f + ': ' + fra);
    s = s.split(fra).join(til);
  }
  return s;
}

// Det minispillene bruker: navnerom og hjelpere, lyd, spill-API-et og spørsmålsvisningen.
const kjerne = ['core/00-ns.js', 'core/05-audio.js', 'core/10-mgapi.js', 'ui/question.js'].map((f) => join(src, f));
const js = [...kjerne, ...spillfiler].map(les).join('\n;\n');
const cssFiler = [join(src, 'ui/tokens.css'), join(src, 'ui/base.css'),
  ...filer('ui', '.css').filter((f) => !/\/(tokens|base)\.css$/.test(f))];
const css = cssFiler.map((f) => readFileSync(f, 'utf8')).join('\n') + `
/* naturfag.klassetavla.no: ramme rundt ett spill */
.nf-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-block: 6px 12px; margin-bottom: 10px; border-bottom: 1px dashed var(--line-strong); }
.nf-top a { color: var(--chalk-dim); text-decoration: none; font-weight: 700; min-height: 40px; display: inline-flex; align-items: center; }
.nf-top a:hover { color: var(--chalk); }
.nf-niva { margin-left: auto; display: flex; gap: 4px; align-items: center; }
.nf-niva .label { margin-right: 4px; }
.nf-niva button { min-width: 38px; min-height: 38px; border-radius: 999px; border: 1px solid var(--line-strong); background: transparent; color: var(--chalk-dim); cursor: pointer; font-weight: 700; }
.nf-niva button[aria-pressed="true"] { background: var(--chalk); color: var(--board); border-color: var(--chalk); }
.nf-slutt { margin-top: 16px; }
.chip.lvl { display: none; }
`;
const minifiser = (kode, loader) => execFileSync('npx', ['--yes', 'esbuild@0.27.0', '--minify', '--legal-comments=none', '--loader=' + loader],
  { input: kode, encoding: 'utf8', maxBuffer: 1 << 26 });

mkdirSync(join(ut, 'spill'), { recursive: true });
writeFileSync(join(ut, 'spill/nv.js'), minifiser(js, 'js'));
writeFileSync(join(ut, 'spill/nv.css'), minifiser(css, 'css'));

// Skriftene er selvhostet (OFL), så ingen kall går til Google.
mkdirSync(join(ut, 'fonts'), { recursive: true });
for (const f of readdirSync(join(kilde, 'pwa/fonts'))) copyFileSync(join(kilde, 'pwa/fonts', f), join(ut, 'fonts', f));
copyFileSync(join(kilde, 'pwa/fonts.css'), join(ut, 'fonts.css'));

// Metadata fra registreringen i hver fil
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const spill = [];
for (const f of spillfiler) {
  const s = readFileSync(f, 'utf8');
  const reg = s.match(/NG\.minigames\.register\(\{([\s\S]*?)start\(/);
  if (!reg) continue;
  const felt = (k) => { const m = reg[1].match(new RegExp(k + ":\\s*(['\"])((?:\\\\.|(?!\\1).)*)\\1")); return m ? m[2].replace(/\\(.)/g, '$1') : ''; };
  const idM = s.match(/const ID = ['"]([a-z0-9-]+)['"]/);
  const id = idM ? idM[1] : felt('id');
  const region = felt('region');
  if (!TEMA[region]) continue;
  spill.push({ id, tittel: felt('title'), tema: TEMA[region] || 'praksis', tekst: felt('blurb'),
    minutter: Number((reg[1].match(/minutes:\s*([\d.]+)/) || [])[1]) || null });
}

for (const g of spill) {
  const side = `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(g.tittel)} · Naturfag</title>
<meta name="description" content="${esc(g.tekst)}">
<meta name="theme-color" content="#17221f">
<link rel="icon" href="../ikon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../fonts.css">
<link rel="stylesheet" href="nv.css">
</head>
<body>
<div id="app">
  <nav class="nf-top">
    <a href="../tema/${g.tema}.html">← ${esc(TEMANAVN[g.tema])}</a>
    <div class="nf-niva" role="group" aria-label="Vanskelighetsgrad"><span class="label">Nivå</span>
      <button type="button" data-d="1">1</button><button type="button" data-d="2">2</button><button type="button" data-d="3">3</button></div>
  </nav>
  <div class="mg-root" id="mg-root"></div>
  <div class="nf-slutt" id="nf-slutt" hidden></div>
</div>
<div class="toast-wrap" id="toasts" role="status" aria-live="polite"></div>
<script src="nv.js"></script>
<script>
(function () {
  'use strict';
  var ID = ${JSON.stringify(g.id)};
  var q = new URLSearchParams(location.search);
  var d = Math.min(3, Math.max(1, Number(q.get('d')) || 1));
  var def = NG.minigames.get(ID);
  var root = document.getElementById('mg-root');
  var slutt = document.getElementById('nf-slutt');
  document.querySelectorAll('.nf-niva button').forEach(function (b) {
    b.setAttribute('aria-pressed', String(Number(b.dataset.d) === d));
    b.addEventListener('click', function () { d = Number(b.dataset.d); history.replaceState(null, '', '?d=' + d);
      document.querySelectorAll('.nf-niva button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); }); kjor(); });
  });
  function kjor() {
    root.innerHTML = ''; slutt.hidden = true; slutt.innerHTML = '';
    var api = NG.makeMinigameApi({ seed: Math.floor(Math.random() * 1e9), difficulty: d, onDone: function (r) {
      var del = r.total ? r.correct + ' av ' + r.total + ' riktig' : Math.round(r.score * 100) + ' %';
      slutt.appendChild(NG.el('div', { class: 'card row' }, [
        NG.el('span', { class: 'grow', html: '<strong>Ferdig.</strong> ' + del + '.' }),
        NG.el('button', { class: 'btn primary', type: 'button', text: 'Spill igjen', onclick: function () { kjor(); scrollTo(0, 0); } }),
      ]));
      slutt.hidden = false;
    } });
    def.start(root, api);
  }
  if (def) kjor(); else root.textContent = 'Fant ikke spillet.';
})();
</script>
</body>
</html>
`;
  writeFileSync(join(ut, 'spill', g.id + '.html'), side);
}

writeFileSync(join(ut, 'spill/spill.json'), JSON.stringify(spill, null, 2) + '\n');
console.log(spill.length + ' spill bygd, nv.js ' + (readFileSync(join(ut, 'spill/nv.js')).length / 1024).toFixed(0) + ' KB');
