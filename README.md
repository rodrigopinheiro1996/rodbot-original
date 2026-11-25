# rodbot-original

Versões originais dos bookmarklets (BM) do rod bot para o Blip Desk.

| Arquivo | O que é |
|---|---|
| `rodbot (revisado).html` | **Versão em uso (v10.1).** Instalador do BM gerado a partir de `src/`. |
| `rodbot-final V10.0.html` | Backup: versão com o painel de fluxos (Montar/Acompanhar). Não mexer. |
| `RodBot-antigo hugme melhorado p qualquer planilha.html` | BM antigo (HugMe). |

## Como mudar o rod bot (revisado)

Nunca edite o HTML à mão. O código fica em `src/`:

- `src/rodbot.js` — o bookmarklet (painel e ações no Blip).
- `src/puro-lote.js` — funções puras do lote Enviar + Finalizar (testadas no Node). Tem a versão (`LOTE_VERSAO`).
- `src/instalador.html` — modelo da página instaladora.

```bash
npm run build   # gera "rodbot (revisado).html"
npm test        # funções puras + HTML em sincronia + teste de tela na página falsa do Blip
```

O teste de tela usa `tests/blip-falso.html`, uma página **falsa** do Blip com dados fictícios. O que está marcado
como "deduzido" nela não foi confirmado no Blip real.

## O que mudou na v10.1 (Enviar + Finalizar)

- Relê a lista a cada cliente e rola para o Blip carregar mais (antes tratava só os já carregados).
- Cliente com problema é pulado com o motivo no log; o lote segue. 8 problemas seguidos = lote pausa.
- Nunca reenvia: memória de 24 h por número de ticket, gravada antes do envio. Antes, um erro depois do envio
  fazia o bot enviar de novo para o mesmo cliente a cada 5 s.
- Envio confirmado na tela antes de pôr a tag. Se a tag/finalizar falhar: "enviado, NÃO finalizado" e fecha o que
  ficou aberto.
- Tag: nunca escolhe "a primeira da lista"; modal: nunca clica num botão qualquer.
- Modo 🧪 Simular (vem marcado): abre cada chat e preenche o texto, mas não envia nem finaliza.
- Anti-bloqueio avisa no log quando liga, quando falha e quando o navegador desliga; avisa quando a página fica
  escondida e quanto tempo o navegador segurou o bot.
- Log salvo no navegador (botão 💾 Log, sobrevive a reinício do PC) e relatório CSV do lote (📄 Relatório).
