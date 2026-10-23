/**
 * Original vector drawings created for the coloring reward catalog.
 * The source artwork is stored locally in public/coloring-pages/.
 */
const LOCAL_ASSET_PREFIX = '/public/coloring-pages/';
const PROJECT_SOURCE = 'https://github.com/silvawbr/revisa_1b';

const originals = [
  ['puppy-picnic', 'Filhote no piquenique', 'Um filhote aproveitando um piquenique no parque.', 'portrait'],
  ['fox-mushroom-forest', 'Raposa na floresta', 'Uma raposa entre cogumelos e árvores da floresta.', 'portrait'],
  ['lion-butterfly-garden', 'Leão e borboletas', 'Um leão simpático em um jardim com flores e borboletas.', 'portrait'],
  ['elephant-flower-watering', 'Elefante regando flores', 'Um elefante rega flores em um jardim.', 'portrait'],
  ['panda-bamboo-picnic', 'Panda entre bambus', 'Um panda rodeado por bambus e folhas.', 'portrait'],
  ['hedgehog-autumn-apples', 'Ouriço e maçãs de outono', 'Um ouriço com maçãs e folhas de outono.', 'portrait'],
  ['turtle-coral-reef', 'Tartaruga no recife de coral', 'Uma tartaruga marinha entre corais e plantas do oceano.', 'portrait'],
  ['giraffe-safari', 'Girafa no safári', 'Uma girafa em uma paisagem de safári.', 'portrait'],
  ['squirrel-oak-tree', 'Esquilo e carvalho', 'Um esquilo ao lado de um grande carvalho.', 'portrait'],
  ['raccoon-camping', 'Guaxinim acampando', 'Um guaxinim perto de uma barraca em um acampamento.', 'portrait'],
  ['birdhouse-robin', 'Coruja e casinha de passarinho', 'Uma coruja perto de uma casinha de passarinho no jardim.', 'portrait'],
  ['frog-lily-pad', 'Sapo no lago', 'Um sapo em um lago com flores e plantas aquáticas.', 'portrait'],
  ['dolphin-bubbles', 'Golfinho entre bolhas', 'Um golfinho nadando entre bolhas no oceano.', 'portrait'],
  ['whale-sailing', 'Baleia e veleiro', 'Uma baleia e um pequeno veleiro sobre as ondas.', 'portrait'],
  ['koala-eucalyptus', 'Coala na árvore de eucalipto', 'Um coala em uma árvore de eucalipto.', 'portrait'],
  ['owl-library', 'Coruja na biblioteca', 'Uma coruja entre estantes de livros.', 'portrait'],
  ['dragon-castle', 'Dragão e castelo', 'Um dragão amigável voa diante de um castelo.', 'portrait'],
  ['unicorn-rainbow', 'Unicórnio no arco-íris', 'Um unicórnio original em um jardim com arco-íris.', 'portrait'],
  ['robot-garden', 'Robô cuidando do jardim', 'Um robô amigável cuidando de flores.', 'portrait'],
  ['moon-rover', 'Robô explorador lunar', 'Um robô explorador em uma paisagem lunar.', 'portrait'],
  ['friendly-robot-workshop', 'Robô na oficina', 'Um robô amigável em uma oficina organizada.', 'portrait'],
  ['rocket-saturn', 'Foguete perto de Saturno', 'Um foguete original voa ao lado de um planeta com anéis.', 'portrait'],
  ['astronaut-moon', 'Astronauta no espaço', 'Um astronauta explora a superfície da Lua.', 'portrait'],
  ['pirate-ship', 'Navio pirata no mar', 'Um navio de aventura navega sobre ondas tranquilas.', 'portrait'],
  ['mountain-hiking', 'Aventura nas montanhas', 'Um urso explorador diante de montanhas.', 'portrait'],
  ['hot-air-balloon', 'Passeio de balão', 'Um balão de ar quente atravessa uma paisagem aberta.', 'portrait'],
  ['soccer-puppy', 'Filhote jogando futebol', 'Um filhote brinca em um campo de futebol.', 'portrait'],
  ['basketball-friends', 'Amigos jogando basquete', 'Amigos jogam basquete em uma quadra.', 'portrait'],
  ['skateboard-cat', 'Gatinho andando de skate', 'Um gatinho original passeia de skate.', 'portrait'],
  ['animal-music-band', 'Banda de animais', 'Animais originais formam uma banda musical.', 'portrait'],
];

export const ORIGINAL_COLORING_PAGES = Object.freeze(originals.map(([id, title, alt, orientation]) => ({
  id,
  src: `${LOCAL_ASSET_PREFIX}${id}.svg`,
  alt,
  title,
  orientation,
  origin: 'original',
  attributionRequired: false,
  author: 'Revisão Matemática',
  sourceUrl: PROJECT_SOURCE,
  sourceFileUrl: PROJECT_SOURCE,
  license: 'Arte original do projeto; uso autorizado no aplicativo',
  licenseUrl: PROJECT_SOURCE,
})));
