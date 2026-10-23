# Bloco 05 — Sequências e números por extenso

A atividade independente da AV2 reúne doze questões por rodada, duas de cada categoria NUM-01 a NUM-06. A ordem é embaralhada e a navegação retorna às atividades AV2. O progresso usa `av2-matematica.block-05.sequencias.progress.v1`; conclusão reaproveita estrelas, TTS e recompensa de desenho já existentes.

`src/av2/sequences.js` contém geradores puros, conversão pt-BR, normalização NFC e comparação estrita de palavras, validadores de candidato/resposta e geração de rodada. Sequências e antecessor/sucessor ficam entre 0 e 250. As tabelas mantêm a ordem crescente e a tabela completa 200–239 tem 40 casas, com campos independentes para cada lacuna. Reconhecimento e escrita permitem 0–250 e também 300 e 400 exatos.

A atividade usa entrada numérica para lacunas e campo de texto real para escrita por extenso. A resposta escrita permanece no campo após erro e pode ser corrigida. A fala inicial da escrita só instrui a criança e não pronuncia a resposta. A correção exige grafia correta, permitindo diferenças de caixa e espaços, sem aproximação fonética ou por similaridade.

## Limites verificados

- Sequências crescentes e decrescentes usam somente passos de +1 e −1 e não ultrapassam 0–250.
- Antecessor de 0 e sucessor de 250 não são gerados.
- A tabela escolar apresenta 200–239 sem lacunas na sequência subjacente; lacunas individuais e resposta total são verificadas.
- Valores por extenso aceitos: 0–250, 300 e 400. `cem`, `cento e um`, `duzentos`, `trezentos` e `quatrocentos` têm formas específicas.
- O gerador da revisão antiga não foi alterado.

## Verificação executada

`npm test` e `npm run build`. Os testes da atividade cobrem o domínio completo da conversão, limites, normalização, casos de transição, 2.000 rodadas reproduzíveis e a conclusão de uma rodada pela interface simulada.

## Verificação manual no Preview

1. Abra AV2 Matemática e selecione **Sequências e números por extenso**.
2. Em telefone, confira a tabela de 200 a 239 em cinco colunas, sem rolagem horizontal; preencha todas as lacunas.
3. Digite `DUZENTOS E OITO` e depois uma grafia incorreta para observar acerto e tentativa preservada.
4. Use a leitura em voz alta na questão de escrita e confirme que o áudio inicial não fala a resposta.
5. Termine as doze questões, confira estrelas e desenho, inicie nova rodada e volte à seleção AV2.
