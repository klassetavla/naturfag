#!/usr/bin/env node
// Bygger forsiden, temasidene og filmsidene fra innhold.json og spill/spill.json.
//   node verktoy/bygg.mjs
// Kjør verktoy/bygg-spill.mjs først hvis minispillene er endret.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rot = join(dirname(fileURLToPath(import.meta.url)), '..');
const innhold = JSON.parse(readFileSync(join(rot, 'innhold.json'), 'utf8'));
const spill = existsSync(join(rot, 'spill/spill.json')) ? JSON.parse(readFileSync(join(rot, 'spill/spill.json'), 'utf8')) : [];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TYPER = [['film', 'Filmer', 'Film'], ['modell', 'Modeller og simuleringer', 'Modell'], ['spill', 'Spill', 'Spill']];

// Alle ressurser i ett format.
const alle = [
  ...innhold.ressurser,
  ...spill.map((g) => ({ tittel: g.tittel, tema: g.tema, type: 'spill', fil: 'spill/' + g.id + '.html', minutter: g.minutter,
    malgruppe: ['elev', 'laerer'], tekst: g.tekst })),
];
for (const r of alle) if (!innhold.tema.some((t) => t.id === r.tema)) throw new Error('Ukjent tema «' + r.tema + '» på ' + r.tittel);

function dokument(tittel, beskrivelse, sti, kropp) {
  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(tittel)}</title>
<meta name="description" content="${esc(beskrivelse)}">
<link rel="icon" href="${sti}ikon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${sti}fonts.css">
<link rel="stylesheet" href="${sti}stil.css">
</head>
<body>
<main class="side">
${kropp}
<footer class="fot"><p>En del av <a href="https://www.klassetavla.no">klassetavla.no</a>.</p></footer>
</main>
</body>
</html>
`;
}

const lenke = (r, sti) => /^https?:/.test(r.fil) ? r.fil : r.type === 'film' && r.side ? sti + 'film/' + r.side + '.html' : sti + r.fil;
const flertall = (n, en, fler) => n + ' ' + (n === 1 ? en : fler);

function kort(r, sti) {
  const ekstern = /^https?:/.test(r.fil);
  const typenavn = TYPER.find((t) => t[0] === r.type)[2];
  const mg = r.malgruppe.map((m) => `<span class="chip ${m}">${m === 'elev' ? 'Elev' : 'Lærer'}</span>`).join('');
  return `<a class="kort" href="${esc(lenke(r, sti))}" data-malgruppe="${r.malgruppe.join(' ')}"${ekstern ? ' rel="noopener"' : ''}>
  <span class="etikett">${typenavn}</span>
  <h3>${esc(r.tittel)}</h3>
  <p class="tekst">${esc(r.tekst)}</p>
  <div class="meta">${mg}${r.minutter ? `<span class="chip">${r.minutter} min</span>` : ''}${ekstern ? '<span class="chip ekstern">Egen side</span>' : ''}</div>
</a>`;
}

// Forside
const temakort = (t) => {
  const rs = alle.filter((r) => r.tema === t.id);
  const telling = TYPER.map(([id, , en]) => { const n = rs.filter((r) => r.type === id).length;
    return n ? flertall(n, en.toLowerCase(), { film: 'filmer', modell: 'modeller', spill: 'spill' }[id]) : null; }).filter(Boolean).join(' · ');
  const innmat = t.sporsmal ? `<ul>${t.sporsmal.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : `<p class="ingress">${esc(t.ingress)}</p>`;
  return `<a class="temakort" href="tema/${t.id}.html" style="--tc:var(--t-${t.id})">
  <span class="etikett">${esc(t.kjerneelement)}</span>
  <h3>${esc(t.navn)}</h3>
  ${innmat}
  <span class="etikett telling">${telling || 'Ingenting ennå'}</span>
</a>`;
};
const nokkelark = innhold.tema.filter((t) => !t.tverrgaende);
const tvers = innhold.tema.filter((t) => t.tverrgaende);
writeFileSync(join(rot, 'index.html'), dokument('Naturfag · klassetavla.no',
  'Modeller, filmer og spill i naturfag, sortert etter kjerneelementene i læreplanen.', '', `<header class="topp"><a class="merke" href="https://www.klassetavla.no">klassetavla<span>.no</span></a></header>
<section class="helt">
  <h1>Naturfag</h1>
  <p>Modeller, filmer og spill til undervisningen, sortert etter kjerneelementene i læreplanen. Hvert tema starter med to store spørsmål. Det du finner under, hjelper elevene å svare på dem.</p>
</section>
<section class="blokk" aria-labelledby="h-ark">
  <h2 id="h-ark">Temaer</h2>
  <div class="rutenett">
${nokkelark.map(temakort).join('\n')}
  </div>
</section>
<section class="blokk" aria-labelledby="h-tvers">
  <h2 id="h-tvers">På tvers av temaene</h2>
  <div class="rutenett">
${tvers.map(temakort).join('\n')}
  </div>
</section>`));

// Temasider
mkdirSync(join(rot, 'tema'), { recursive: true });
const filterSkript = `<script>
(function () {
  var knapper = document.querySelectorAll('.filter button');
  function vis(f) {
    knapper.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.f === f)); });
    document.querySelectorAll('.kort').forEach(function (k) { k.hidden = f !== 'alle' && k.dataset.malgruppe.split(' ').indexOf(f) < 0; });
    document.querySelectorAll('.blokk[data-type]').forEach(function (s) { s.hidden = !s.querySelector('.kort:not([hidden])'); });
    try { localStorage.setItem('naturfag.for', f); } catch (e) {}
  }
  knapper.forEach(function (b) { b.addEventListener('click', function () { vis(b.dataset.f); }); });
  var start = 'alle'; try { start = localStorage.getItem('naturfag.for') || 'alle'; } catch (e) {}
  vis(start);
})();
</script>`;
for (const t of innhold.tema) {
  const rs = alle.filter((r) => r.tema === t.id);
  const seksjoner = TYPER.map(([id, navn]) => {
    const liste = rs.filter((r) => r.type === id).sort((a, b) => (b.malgruppe.includes('elev') - a.malgruppe.includes('elev')) || a.tittel.localeCompare(b.tittel, 'nb'));
    return liste.length ? `<section class="blokk" data-type="${id}"><h2>${navn}</h2><div class="rutenett">
${liste.map((r) => kort(r, '../')).join('\n')}
</div></section>` : '';
  }).join('\n');
  const hode = t.sporsmal ? `<div class="sp">${t.sporsmal.map((s) => `<p>${esc(s)}</p>`).join('')}</div>` : `<p class="ingress">${esc(t.ingress)}</p>`;
  const harBegge = rs.some((r) => r.malgruppe.includes('elev')) && rs.some((r) => !r.malgruppe.includes('elev'));
  writeFileSync(join(rot, 'tema', t.id + '.html'), dokument(t.navn + ' · Naturfag', (t.sporsmal || [t.ingress]).join(' '), '../',
    `<header class="topp"><a class="tilbake" href="../index.html">← Alle temaer</a></header>
<section class="temahode" style="--tc:var(--t-${t.id})">
  <span class="etikett">Kjerneelement · ${esc(t.kjerneelement)}</span>
  <h1>${esc(t.navn)}</h1>
  ${hode}
</section>
${harBegge ? `<div class="filter" role="group" aria-label="Vis innhold for"><button type="button" data-f="alle">Alt</button><button type="button" data-f="elev">For elever</button><button type="button" data-f="laerer">For lærere</button></div>` : ''}
<div style="display:contents;--tc:var(--t-${t.id})">
${seksjoner || '<p class="tom">Ingenting her ennå.</p>'}
</div>
${harBegge ? filterSkript : ''}`));
}

// Filmsider for videofiler
mkdirSync(join(rot, 'film'), { recursive: true });
for (const r of alle.filter((r) => r.type === 'film' && r.side)) {
  const t = innhold.tema.find((x) => x.id === r.tema);
  writeFileSync(join(rot, 'film', r.side + '.html'), dokument(r.tittel + ' · Naturfag', r.tekst, '../',
    `<header class="topp"><a class="tilbake" href="../tema/${t.id}.html">← ${esc(t.navn)}</a></header>
<section class="film">
  <span class="etikett">Film · ${r.minutter} min</span>
  <h1 style="font-size:clamp(28px,5vw,44px);margin:6px 0 16px">${esc(r.tittel)}</h1>
  <video controls preload="metadata" playsinline src="../${esc(r.fil)}"></video>
  <p class="tekst">${esc(r.tekst)}</p>
</section>`));
}

console.log('Bygd: index.html, ' + innhold.tema.length + ' temasider, ' + alle.length + ' ressurser (' + spill.length + ' spill)');
