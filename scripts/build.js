// Gera "rodbot (revisado).html" a partir de src/: cola src/puro-lote.js dentro do bookmarklet,
// codifica como javascript: e põe o MESMO código no botão arrastável e no "Copiar código".
// Uso: npm run build
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const SAIDA = 'rodbot (revisado).html';
const MARCADOR = '/*@@PURO-LOTE@@*/';

function montarCodigo() {
  const principal = fs.readFileSync(path.join(raiz, 'src', 'rodbot.js'), 'utf8');
  const puro = fs.readFileSync(path.join(raiz, 'src', 'puro-lote.js'), 'utf8');
  if (!principal.includes(MARCADOR)) throw new Error('marcador ' + MARCADOR + ' não encontrado em src/rodbot.js');
  return principal.replace(MARCADOR, () => puro);
}

function versao() {
  const puro = fs.readFileSync(path.join(raiz, 'src', 'puro-lote.js'), 'utf8');
  const m = puro.match(/const LOTE_VERSAO = '([^']+)'/);
  if (!m) throw new Error('LOTE_VERSAO não encontrada');
  return m[1];
}

// Igual ao instalador antigo: só letras, números, - . _ ficam como estão.
function codificar(js) {
  return 'javascript:' + encodeURIComponent(js).replace(/[!'()*~]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function gerarHtml() {
  const modelo = fs.readFileSync(path.join(raiz, 'src', 'instalador.html'), 'utf8');
  const bm = codificar(montarCodigo());
  return modelo.split('{{BM}}').join(bm).split('{{VERSAO}}').join(versao());
}

if (require.main === module) {
  fs.writeFileSync(path.join(raiz, SAIDA), gerarHtml());
  console.log('Gerado: ' + SAIDA + ' (' + versao() + ')');
}

module.exports = { montarCodigo, codificar, gerarHtml, versao, SAIDA };
