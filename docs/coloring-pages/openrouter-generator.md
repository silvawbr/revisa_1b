# Gerador administrativo de desenhos para colorir

O gerador usa a API de imagens do OpenRouter somente no terminal administrativo. A chave fica em `OPENROUTER_API_KEY`; nunca a coloque em `app.js`, em arquivos de `src/` ou no navegador. Configure também `OPENROUTER_IMAGE_MODEL` com um modelo de imagem disponível na sua conta.

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

A aprovação verifica integridade, formato, resolução, orientação A4 e duplicatas exatas. Em seguida copia a imagem para `public/coloring-pages/`, registra os metadados em `src/data/generatedColoringPages.js` e em `public/coloring-pages/ATTRIBUTIONS.md`, e passa a servir o arquivo localmente. Nenhuma chamada ao OpenRouter ocorre durante as recompensas.
