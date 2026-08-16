# Revisão de Matemática | 1º ano Vita

Aplicação web infantil, responsiva e em português do Brasil para revisar
conteúdos de Matemática do 1º ano Vita. Uma rodada reúne seis
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

Para gerar o pacote estático que será publicado:

```bash
npm run build
```

O build limpa somente `dist/` e recria uma árvore publicável com:

- `dist/index.html`, `dist/styles.css` e `dist/app.js`;
- `dist/src/`, com os módulos ES usados pelo frontend;
- `dist/public/`, com os desenhos locais e suas atribuições.

Arquivos de ambiente, código do servidor, funções, testes, scripts e
configurações privadas não são copiados para `dist/`. A pasta `dist/` continua
ignorada pelo Git.

## Estrutura

- `index.html`: entrada da aplicação.
- `styles.css`: interface responsiva, formas CSS e regras de impressão A4.
- `app.js`: fluxo da experiência, eventos, acessibilidade e telas.
- `src/game.js`: geração, validação e conversão de números para português.
- `src/figures.js`: renderização das figuras espaciais em SVG.
- `src/data/coloringPages.js`: catálogo local, seleção aleatória e metadados de
  licença dos desenhos da recompensa.
- `src/child-profile.js`: validação, normalização e persistência local do nome
  da criança, além da separação entre mensagens visuais e textos neutros de
  voz.
- `src/tts-client.js`: cliente do endpoint interno de voz, com cache de sessão.
- `public/coloring-pages/*.svg`: desenhos aprovados, armazenados localmente
  para uso offline.
- `public/coloring-pages/ATTRIBUTIONS.md`: origem, licença e auditoria visual de
  cada desenho, incluindo candidatos rejeitados.
- `server.js`: servidor HTTP local para os arquivos estáticos e o endpoint
  `POST /api/tts`.
- `api/tts.js`: entrypoint da função Node serverless da Vercel para
  `POST /api/tts`.
- `server/tts-handler.js`: handler HTTP compartilhado pelo servidor local e
  pela função da Vercel.
- `server/tts-provider.js`: adaptador do OpenRouter com Bearer, áudio binário,
  cache server-side, timeout, validação e tratamento seguro de erros.
- `server/pcm-to-wav.js`: encapsulamento determinístico de PCM em WAV, sem
  alterar os samples e sem processo externo de áudio.
- `tests/game.test.mjs`: testes automatizados da lógica pedagógica.
- `tests/figures.test.mjs`: testes das figuras espaciais em SVG.
- `tests/coloring-pages.test.mjs`: testes do catálogo, fallback, seleção,
  entrega local dos assets, atribuição e impressão A4.
- `tests/child-profile.test.mjs`: testes do perfil local, personalização e
  privacidade do texto enviado ao TTS.
- `tests/tts.test.mjs`: testes do contrato HTTP, segurança e cache de voz.
- `tests/vercel.test.mjs`: testes do build estático, função Vercel, assets e
  ausência de segredos em `dist/`.

Tudo funciona sem cadastro, sem armazenamento server-side e sem imagens externas. O
primeiro acesso solicita somente o primeiro nome ou apelido e o mantém
exclusivamente no `localStorage` do navegador, na chave versionada
`revisao-matematica.childName.v1`. Em dispositivos compartilhados, a ação
“Trocar criança” remove somente esse nome e volta à tela de identificação. Os
desenhos da recompensa são instalados junto com o projeto; não há hotlink nem
download durante o uso. A origem, licença e auditoria visual dos desenhos estão
registradas em `public/coloring-pages/ATTRIBUTIONS.md`.

Mensagens personalizadas ficam apenas na interface. A versão enviada ao
`/api/tts` é sempre um texto pedagógico neutro, sem o nome da criança, e o
frontend continua enviando somente a propriedade `text`.

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

## Publicar na Vercel

O repositório usa o preset `Other` e a configuração versionada em
`vercel.json`. O build publica somente o conteúdo de `dist/`; a função
`api/tts.js` é descoberta automaticamente pela Vercel e continua disponível
em `/api/tts`. Não é necessário iniciar `server.js` na Vercel e não há rewrite
para `index.html`.

No painel do projeto, mantenha:

| Configuração | Valor |
| --- | --- |
| Framework Preset | `Other` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | automático |

Como o projeto não possui dependências externas, o Install Command deve
continuar automático; não use `npm run dev` como comando de instalação.

Configure na Vercel as cinco variáveis abaixo, no ambiente de deployment
correto, sem colocá-las no Git ou no frontend:

```env
api_url=https://openrouter.ai/api/v1/audio/speech
api_key=
tts_model=google/gemini-3.1-flash-tts-preview
tts_voice=Zephyr
tts_response_format=pcm
```

`api_key` deve receber o valor real somente no painel da Vercel. O servidor
monta a chamada para a OpenRouter; o navegador continua enviando apenas
`{ "text": "..." }` para `/api/tts`. Alterações nas variáveis de ambiente só
entram em vigor após um novo deployment.

Após o deployment, valide sem expor a chave:

```text
GET /              → 200 e index.html
GET /styles.css    → 200 e text/css
GET /app.js        → 200 e JavaScript
GET /api/tts       → 405 e Allow: POST
POST /api/tts      → 200 audio/wav com configuração válida
```

Para o teste real de voz, use uma frase curta como `Olá, criança!`, confirme
antes que as cinco variáveis estão configuradas e verifique que a resposta
binária começa com `RIFF` e contém `WAVE`. Os testes automatizados usam apenas
mocks e nunca consomem créditos da OpenRouter.
