const prisma = require('../prismaClient');

const sequences = [
  { table: 'users', sequence: 'users_id_seq' },
  { table: 'fridge_items', sequence: 'fridge_items_id_seq' },
  { table: 'shopping_items', sequence: 'shopping_items_id_seq' },
  { table: 'recipes', sequence: 'recipes_id_seq' },
  { table: 'ingredients', sequence: 'ingredients_id_seq' },
  { table: 'steps', sequence: 'steps_id_seq' },
  { table: 'refresh_tokens', sequence: 'refresh_tokens_id_seq' },
  { table: 'favorites', sequence: 'favorites_id_seq' },
];

const buildQuery = (table, sequence) =>
  `SELECT setval('${sequence}', (SELECT COALESCE(MAX(id), 0) + 1 FROM "${table}"), false);`;

async function syncSequences() {
  for (const { table, sequence } of sequences) {
    try {
      await prisma.$executeRawUnsafe(buildQuery(table, sequence));
    } catch (error) {
      console.error(`Failed to sync sequence ${sequence}`, error);
    }
  }
}

module.exports = syncSequences;
