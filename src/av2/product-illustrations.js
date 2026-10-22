const illustration = (id, src, article) => Object.freeze({ id, src, article });

export const AV2_PRODUCT_ILLUSTRATIONS = Object.freeze([
  illustration('notebook', '/public/av2-products/notebook.svg', 'o'),
  illustration('book', '/public/av2-products/book.svg', 'o'),
  illustration('pencil', '/public/av2-products/pencil.svg', 'o'),
  illustration('glue', '/public/av2-products/glue.svg', 'a'),
  illustration('scissors', '/public/av2-products/scissors.svg', 'a'),
  illustration('eraser', '/public/av2-products/eraser.svg', 'a'),
  illustration('ruler', '/public/av2-products/ruler.svg', 'a'),
  illustration('crayon', '/public/av2-products/crayon.svg', 'o'),
  illustration('doll', '/public/av2-products/doll.svg', 'a'),
  illustration('toy-car', '/public/av2-products/toy-car.svg', 'o'),
  illustration('ball', '/public/av2-products/ball.svg', 'a'),
  illustration('teddy-bear', '/public/av2-products/teddy-bear.svg', 'o'),
  illustration('board-game', '/public/av2-products/board-game.svg', 'o'),
  illustration('toy', '/public/av2-products/toy.svg', 'o'),
  illustration('juice', '/public/av2-products/juice.svg', 'o'),
  illustration('sandwich', '/public/av2-products/sandwich.svg', 'o'),
  illustration('popcorn', '/public/av2-products/popcorn.svg', 'a'),
  illustration('gum', '/public/av2-products/gum.svg', 'o'),
]);

const illustrationById = new Map(AV2_PRODUCT_ILLUSTRATIONS.map((item) => [item.id, item]));

const illustrationIdByLabel = Object.freeze({
  Caderno: 'notebook',
  Livro: 'book',
  Lápis: 'pencil',
  Cola: 'glue',
  Tesoura: 'scissors',
  Borracha: 'eraser',
  Régua: 'ruler',
  'Giz de cera': 'crayon',
  Boneca: 'doll',
  Carrinho: 'toy-car',
  Bola: 'ball',
  Urso: 'teddy-bear',
  Jogo: 'board-game',
  Brinquedo: 'toy',
  Suco: 'juice',
  Sanduíche: 'sandwich',
  Pipoca: 'popcorn',
  Chiclete: 'gum',
});

export function getAv2ProductIllustration(id) {
  return illustrationById.get(id) ?? null;
}

export function getAv2ProductIllustrationId(label) {
  return illustrationIdByLabel[label] ?? null;
}
