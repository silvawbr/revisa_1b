# Bloco 05 — Sequências e números por extenso

A atividade independente da AV2 reúne doze questões por rodada, duas de cada categoria NUM-01 a NUM-06. A ordem é embaralhada e a navegação retorna às atividades AV2. O progresso usa `av2-matematica.block-05.sequencias.progress.v1`; conclusão reaproveita estrelas, TTS e recompensa de desenho já existentes.

`src/av2/sequences.js` contém geradores puros, conversão pt-BR, validadores de candidato/resposta e geração de rodada. Sequências e antecessor/sucessor ficam entre 0 e 250. As tabelas mantêm a ordem crescente e a tabela completa 200–239 tem 40 casas, com campos independentes para cada lacuna. As questões por extenso permitem 0–250 e também 300 e 400 exatos.

A atividade usa entrada numérica para lacunas. Nas questões de reconhecimento, a criança vê o número escrito por extenso e escolhe seu correspondente. Nas questões NUM-06, vê o número e escolhe entre quatro escritas por extenso, com seleção e confirmação iguais às da primeira revisão. A resposta pode ser tentada novamente após um erro. A fala inicial não pronuncia a alternativa correta.

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
3. Na questão NUM-06, confira as quatro alternativas e selecione uma correta e uma incorreta para observar confirmação e feedback de nova tentativa.
4. Use a leitura em voz alta na questão NUM-06 e confirme que o áudio inicial não fala a alternativa correta.
5. Termine as doze questões, confira estrelas e desenho, inicie nova rodada e volte à seleção AV2.
