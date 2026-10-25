/** Portuguese animal names mapped to predefined, simple natural habitats. */
export const ANIMAL_DETAILS = Object.freeze({
  'peixe-boi': 'a manatee swimming in a calm freshwater river beside aquatic plants',
  'onça-pintada': 'a jaguar walking beside large leaves in a tropical forest',
  'capivara': 'a capybara resting on a grassy riverbank',
  'tucano': 'a toucan perched on a branch in a tropical forest',
  'arara': 'a macaw perched on a branch beside tropical leaves',
  'tartaruga-marinha': 'a sea turtle swimming beside seagrass in the ocean',
  'boto': 'an Amazon river dolphin swimming in a freshwater river',
  'preguiça': 'a sloth hanging from a branch in a tropical forest',
  'tamanduá': 'an anteater walking beside an anthill in the savanna',
  'lobo-guará': 'a maned wolf walking through grass in the Brazilian cerrado',
  'coelho': 'a rabbit sitting in a meadow beside a few flowers',
  'borboleta': 'a butterfly flying above flowers in a meadow',
  'sapo': 'a frog sitting beside a pond and a few water lilies',
  'peixe': 'a freshwater fish swimming in a river beside aquatic plants',
  'leão': 'a lion resting in the savanna beside a small acacia tree',
  'elefante': 'an elephant walking in the savanna beside a small tree',
  'girafa': 'a giraffe beside an acacia tree in the savanna',
  'pinguim': 'a penguin standing on a rocky Antarctic shore beside the sea',
  'baleia': 'a whale swimming in the ocean beside a few bubbles',
  'urso-polar': 'a polar bear walking on Arctic sea ice',
});

export function normalizeAnimal(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') : '';
}

export function isValidAnimal(value) {
  const animal = normalizeAnimal(value);
  return animal.length >= 2 && animal.length <= 60 && /^[\p{L}]+(?:[ -][\p{L}]+)*$/u.test(animal);
}

export function pickAnimalSuggestions(random = Math.random) {
  const animals = Object.keys(ANIMAL_DETAILS);
  for (let i = animals.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [animals[i], animals[j]] = [animals[j], animals[i]];
  }
  return animals.slice(0, 10);
}
