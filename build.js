#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Handlebars = require('handlebars');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DATA = path.join(ROOT, 'data');
const OVERLAYS = path.join(DATA, 'overlays');
const DIST = path.join(ROOT, 'dist');

const SECTIONS = ['header', 'summary', 'competencies', 'experience', 'education', 'certifications', 'languages'];

// --- helpers -------------------------------------------------------------
function loadYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Deep merge: overlay wins. Objects merge recursively. Arrays and scalars in
// overlay REPLACE (no per-item merge) — keeps overlay behavior predictable.
function deepMerge(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;
  const out = Object.assign({}, base);
  for (const key of Object.keys(overlay)) {
    if (isPlainObject(overlay[key]) && isPlainObject(base[key])) {
      out[key] = deepMerge(base[key], overlay[key]);
    } else {
      out[key] = overlay[key];
    }
  }
  return out;
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  fs.copyFileSync(src, dst);
}

// --- load data -----------------------------------------------------------
console.log('build: loading base + overlays');
const base = loadYaml(path.join(DATA, 'base.yaml'));

const variants = { default: base };
if (fs.existsSync(OVERLAYS)) {
  for (const file of fs.readdirSync(OVERLAYS)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const name = file.replace(/\.ya?ml$/, '');
    const overlay = loadYaml(path.join(OVERLAYS, file));
    variants[name] = deepMerge(clone(base), overlay || {});
    console.log(`  overlay: ${name}`);
  }
}

// --- register partials ---------------------------------------------------
const partialsDir = path.join(SRC, 'partials');
for (const file of fs.readdirSync(partialsDir)) {
  if (!file.endsWith('.hbs')) continue;
  const name = file.replace(/\.hbs$/, '');
  Handlebars.registerPartial(name, fs.readFileSync(path.join(partialsDir, file), 'utf8'));
}

// --- pre-render each section per variant --------------------------------
// The client-side switcher swaps innerHTML of [data-section=X] with the
// pre-rendered HTML from this blob.
const sectionTemplates = {};
for (const section of SECTIONS) {
  sectionTemplates[section] = Handlebars.compile('{{> ' + section + '}}');
}

const variantsRendered = {};
for (const [name, data] of Object.entries(variants)) {
  const rendered = {};
  for (const section of SECTIONS) {
    rendered[section] = sectionTemplates[section](data).trim();
  }
  rendered._title = `${data.meta.name} — ${data.meta.headline || 'resume'}`;
  variantsRendered[name] = rendered;
}

// --- render main template with default variant --------------------------
const mainTemplate = Handlebars.compile(fs.readFileSync(path.join(SRC, 'template.hbs'), 'utf8'));
const html = mainTemplate({
  ...base,
  variantsJson: JSON.stringify(variantsRendered).replace(/</g, '\\u003c'),
});

// --- write output --------------------------------------------------------
ensureDir(DIST);
fs.writeFileSync(path.join(DIST, 'index.html'), html);
copyFile(path.join(SRC, 'styles.css'), path.join(DIST, 'styles.css'));
copyFile(path.join(SRC, 'switcher.js'), path.join(DIST, 'switcher.js'));

// GitHub Pages: skip Jekyll processing.
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

console.log(`build: wrote dist/ (${Object.keys(variants).length} variants: ${Object.keys(variants).join(', ')})`);
