# rodbot-original

Versões originais dos bookmarklets (BM) do rod bot para o Blip Desk.

| Arquivo | O que é |
|---|---|
| `rodbot (revisado).html` | **Versão em uso (v10.1):** o painel de fluxos da V10.0 (Montar/Acompanhar) com as melhorias abaixo. Gerado a partir de `src/`. |
| `rodbot-final V10.0.html` | Backup da V10.0 original. Não mexer. |
| `RodBot-antigo hugme melhorado p qualquer planilha.html` | BM antigo (HugMe). |

## Como mudar o rod bot (revisado)

Nunca edite o HTML à mão. O código fica em `src/`:

- `src/rodbot.js` — o bookmarklet (painel e ações no Blip).
- `src/puro-lote.js` — funções puras das melhorias (testadas no Node). Tem a versão (`LOTE_VERSAO`).
- `src/instalador.html` — modelo da página instaladora.

```bash
npm run build   # gera "rodbot (revisado).html"
npm test        # funções puras + HTML em sincronia + teste de tela na página falsa do Blip
```

O teste de tela usa `tests/blip-falso.html`, uma página **falsa** do Blip com dados fictícios. O que está marcado
como "deduzido" nela não foi confirmado no Blip real.

## O que mudou na v10.1 (em relação à V10.0)

- O fluxo relê a lista a cada cliente e rola para o Blip carregar mais (antes tratava só os já carregados).
- Cliente com problema é pulado com o motivo no log; o fluxo segue. 8 problemas seguidos = fluxo pausa.
- Nunca reenvia a mesma mensagem: memória de 24 h por ticket + mensagem, gravada antes do envio, também entre
  execuções (antes a memória zerava a cada Iniciar).
- Enviar + Finalizar: se a tag/finalizar falhar, o ticket fica "enviado, NÃO finalizado" e o bot fecha o que ficou aberto.
- Tag: nunca escolhe "a primeira da lista"; modal: nunca clica num botão qualquer.
- Rascunho num chat não trava mais todos os clientes seguintes.
- 🧪 Simular (vem marcado, ao lado do Iniciar): abre cada chat e preenche o texto, mas não envia, não finaliza, não
  pausa, não move e não transfere. Envio real pede confirmação.
- Anti-bloqueio avisa no log quando liga, quando falha e quando o navegador desliga; avisa quando a página fica
  escondida e quanto tempo o navegador segurou o bot.
- Log salvo no navegador (💾 Log, sobrevive a reinício do PC) e relatório CSV da execução (📄 Relatório), na aba Acompanhar.
