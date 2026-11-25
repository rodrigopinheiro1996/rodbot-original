// O HTML instalador precisa estar igual ao que src/ gera, e o favorito arrastável e o
// "Copiar código" precisam entregar exatamente a mesma versão.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const build = require('../scripts/build');

const html = fs.readFileSync(path.join(__dirname, '..', build.SAIDA), 'utf8');

test('o HTML está em sincronia com src/ (rode npm run build)', () => {
  assert.ok(html === build.gerarHtml(), 'HTML desatualizado: rode npm run build');
});

test('botão arrastável e "Copiar código" têm o mesmo código', () => {
  const href = html.match(/id="bm-button"[^>]*href="(javascript:[^"]*)"/);
  const valor = html.match(/id="bm-code"[^>]*value="(javascript:[^"]*)"/);
  assert.ok(href && valor, 'botão ou caixa de código não encontrados');
  assert.strictEqual(href[1], valor[1]);
  assert.strictEqual(decodeURIComponent(href[1].slice(11)), build.montarCodigo());
});

test('o código do bookmarklet é JavaScript válido e mostra a versão', () => {
  const codigo = build.montarCodigo();
  assert.doesNotThrow(() => new vm.Script(codigo));
  assert.ok(html.includes('Versão ' + build.versao()));
  assert.ok(codigo.includes("rod bot · ' + LOTE_VERSAO") || codigo.includes('LOTE_VERSAO'));
});
