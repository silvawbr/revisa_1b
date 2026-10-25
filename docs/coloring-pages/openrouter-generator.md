# Gerador de desenhos para colorir

> O botão de geração sob demanda continua ativo na recompensa. O fluxo abaixo
> de revisão e aprovação de imagens locais é legado; a seleção do catálogo usa
> páginas licenciadas do Wikimedia Commons em `src/data/searchColoringPages.js`.

O gerador administrativo usa a API de imagens do OpenRouter pelo terminal. A chave fica em `OPENROUTER_API_KEY`; nunca a coloque em `app.js`, em arquivos de `src/` ou no navegador. Configure também `OPENROUTER_IMAGE_MODEL` com um modelo de imagem disponível na sua conta.

## Gerar na tela da recompensa

O botão “Gerar desenho novo” chama `POST /api/coloring`. Ele usa a chave privada `api_key` (ou `OPENROUTER_API_KEY`) e `OPENROUTER_IMAGE_MODEL`, que devem estar configuradas no ambiente do servidor. Ao clicar, um popup permite à criança digitar o nome de um animal em português ou tocar em uma das 10 sugestões sorteadas. “Ver outros animais” renova as sugestões. O navegador envia `{ animal, source }`, com `source` igual a `typed` ou `suggestion`. O mapa `ANIMAL_DETAILS` em `src/data/coloringAnimals.js` associa cada sugestão a um cenário predefinido (por exemplo, peixe-boi em um rio). Para nomes digitados, o modelo escolhe um habitat natural apropriado. O servidor valida nomes de 2 a 60 caracteres com letras, espaços e hífens e mantém estilo infantil, contornos pretos, fundo branco, margens e formato retrato fixos. O nome da criança não é enviado.

A resposta é validada como PNG ou JPEG em orientação retrato e entregue diretamente à tela para colorir e imprimir. Ela não é gravada, revisada nem incluída no catálogo. O fluxo administrativo abaixo continua documentado para manter os assets locais legados; ele exige inspeção visual e aprovação com metadados de licença, mas não alimenta o catálogo ativo do Wikimedia Commons.

```sh
export OPENROUTER_API_KEY="..."
export OPENROUTER_IMAGE_MODEL="provedor/modelo-de-imagem"
npm run coloring:generate -- generate --count 3 --themes cats,robots,space --orientation portrait
```

Os temas aceitos são `animals`, `cats`, `dogs`, `nature`, `adventure`, `robots`, `space`, `sports` e `characters`. O script usa prompts padronizados sem nome, foto ou informação da criança. Cada resposta precisa ser PNG ou JPEG, ter ao menos 700 pixels em cada dimensão e respeitar a proporção A4 solicitada. As imagens ficam em `work/coloring-pages-review/`; ainda não fazem parte do catálogo.

## Revisão e aprovação

Abra cada arquivo pendente em um visualizador de imagens e confira se tem fundo branco, contornos nítidos, espaços úteis para colorir, composição adequada para impressão e nenhum texto, marca d'água ou personagem protegido. A lista dos candidatos pode ser vista com:

```sh
npm run coloring:generate -- review
```

Depois da revisão visual, aprove um candidato informando metadados de licença e autoria que correspondam aos termos do modelo/provedor:

```sh
npm run coloring:generate -- approve \
  --id review-cats-12345678 \
  --title "Gatinho entre flores" \
  --alt "Um gatinho original entre flores grandes." \
  --author "Modelo e provedor de imagem" \
  --license "Termos aplicáveis do provedor" \
  --license-url "https://exemplo.org/termos"
```

A aprovação verifica integridade, formato, resolução, orientação A4 e duplicatas exatas. Em seguida copia a imagem para `public/coloring-pages/`, registra os metadados em `src/data/generatedColoringPages.js` e em `public/coloring-pages/ATTRIBUTIONS.md`, e passa a servir o arquivo localmente. Os assets aprovados permanecem locais e podem ser servidos offline; a seleção da recompensa agora usa o catálogo remoto do Wikimedia Commons.
