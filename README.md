# Revisão de Matemática da Marina

Aplicação web infantil, responsiva e em português do Brasil para revisar
conteúdos de Matemática do 1º ano do Ensino Fundamental. Uma rodada reúne seis
atividades: figuras planas, figuras espaciais, antecessor e sucessor, números
por extenso, adição com reserva e soma com número desconhecido.

Ao concluir a rodada, a criança recebe um desenho local para colorir. A
aplicação inclui um servidor Node mínimo para servir os arquivos estáticos e
gerar voz pelo endpoint de Text-to-Speech do OpenRouter, sem expor a chave no
navegador.

## Requisitos

- Node.js 18 ou superior
- npm

Não há dependências externas para instalar: o projeto usa apenas APIs nativas
do Node.js.

## Executar localmente

Requer Node.js 18+ disponível no computador. Para configurar a leitura:

```bash
cp example.env .env
```

Edite `.env`, mantendo a chave somente nesse arquivo privado e preenchendo as
cinco variáveis abaixo. O arquivo `.env` não é servido pela aplicação e os
nomes de arquivos de ambiente local estão ignorados pelo Git.

| Variável | Obrigatória | Valor de exemplo | Sensível |
| --- | ---: | --- | ---: |
| `api_url` | Sim | `https://openrouter.ai/api/v1/audio/speech` | Não |
| `api_key` | Sim | `sk-or-v1-...` | Sim |
| `tts_model` | Sim | `google/gemini-3.1-flash-tts-preview` | Não |
| `tts_voice` | Sim | `Zephyr` | Não |
| `tts_response_format` | Sim | `pcm` | Não |

Em hospedagem, configure essas variáveis no painel do provedor. Alterações nas
variáveis de ambiente podem exigir um novo deploy. A leitura é opcional: sem
uma configuração válida, as atividades continuam disponíveis.

Para iniciar localmente:

```bash
npm start
```

Para desenvolvimento, `npm run dev` encerra qualquer processo que esteja
ocupando a porta configurada e inicia o servidor novamente:

```bash
npm run dev
```

Depois, abra <http://127.0.0.1:4173>. A porta padrão é `4173`; para alterá-la:

```bash
PORT=8080 npm start
```

Para rodar os testes:

```bash
npm test
```

## Estrutura

- `index.html`: entrada da aplicação.
- `styles.css`: interface responsiva, formas CSS e regras de impressão A4.
- `app.js`: fluxo da experiência, eventos, acessibilidade e telas.
- `src/game.js`: geração, validação e conversão de números para português.
- `src/figures.js`: renderização das figuras espaciais em SVG.
- `src/data/coloringPages.js`: catálogo local, seleção aleatória e metadados de
  licença dos desenhos da recompensa.
- `src/tts-client.js`: cliente do endpoint interno de voz, com cache de sessão.
- `public/coloring-pages/*.svg`: desenhos aprovados, armazenados localmente
  para uso offline.
- `public/coloring-pages/ATTRIBUTIONS.md`: origem, licença e auditoria visual de
  cada desenho, incluindo candidatos rejeitados.
- `server.js`: servidor estático e endpoint `POST /api/tts`.
- `server/tts-provider.js`: adaptador do OpenRouter com Bearer, áudio binário,
  cache server-side, timeout, validação e tratamento seguro de erros.
- `server/pcm-to-wav.js`: encapsulamento determinístico de PCM em WAV, sem
  alterar os samples e sem processo externo de áudio.
- `tests/game.test.mjs`: testes automatizados da lógica pedagógica.
- `tests/figures.test.mjs`: testes das figuras espaciais em SVG.
- `tests/coloring-pages.test.mjs`: testes do catálogo, fallback, seleção,
  entrega local dos assets, atribuição e impressão A4.
- `tests/tts.test.mjs`: testes do contrato HTTP, segurança e cache de voz.

Tudo funciona sem cadastro, armazenamento de dados ou imagens externas. Os
desenhos da recompensa são instalados junto com o projeto; não há hotlink nem
download durante o uso. A origem, licença e auditoria visual dos desenhos estão
registradas em `public/coloring-pages/ATTRIBUTIONS.md`.

## Segurança da configuração

O arquivo `.env` é ignorado pelo Git e deve permanecer privado. Nunca inclua
uma chave real no repositório, no HTML, no JavaScript público, em logs ou em
relatórios. O navegador envia somente `{ "text": "..." }` para `/api/tts`; as
demais configurações permanecem no servidor.

## Contrato do TTS

O navegador chama somente `POST /api/tts` com `{ "text": "..." }`. O servidor
normaliza e valida o texto, então chama `api_url` com `Authorization: Bearer
api_key` e o payload `{ "model": tts_model, "input": texto, "voice":
tts_voice, "response_format": tts_response_format }`. A configuração ativa
solicita `pcm` ao modelo `google/gemini-3.1-flash-tts-preview` com a voz
`Zephyr`. O OpenRouter entrega PCM mono de 24 kHz e 16 bits; o servidor apenas
acrescenta um cabeçalho WAV, sem alterar os samples, e devolve `audio/wav` ao
navegador. Portanto, `tts_response_format=pcm` é o formato solicitado ao
provedor, enquanto o formato entregue ao navegador é WAV.

| Item | Valor |
| --- | --- |
| `api_url` | `https://openrouter.ai/api/v1/audio/speech` |
| `tts_model` | `google/gemini-3.1-flash-tts-preview` |
| `tts_voice` | `Zephyr` |
| `tts_response_format` | `pcm` |
| formato interno recebido | PCM 24 kHz, 16 bits, mono |
| formato entregue ao navegador | WAV |
| content type entregue | `audio/wav` |

A chave nunca entra no HTML, JavaScript público ou source map. O cache inclui a
configuração de voz, os parâmetros PCM/WAV e a versão das instruções de estilo,
por isso resultados produzidos por uma configuração anterior não são
reutilizados como se fossem o áudio atual.

Os testes usam mocks e não consomem créditos do OpenRouter. Para uma validação
manual, preencha `api_key` somente no `.env` local privado ou nas variáveis da
hospedagem; nunca registre essa chave em logs ou relatórios.
