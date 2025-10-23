const fs = require('fs/promises');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const RECIPES_ROOT = path.join(
  __dirname,
  '..',
  'import',
  'russian-recipes-parser-master',
  'storage',
  'recipes',
);

const DEFAULT_SOURCE = 'vkuso.ru';
const AUTHOR_ID = parseInt(process.env.IMPORT_AUTHOR_ID || '1', 10);

const hourRegex = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:\\u0447\\u0430\\u0441(?:\\u0430|\\u043e\\u0432)?|\\u0447)', 'gi');
const minuteRegex = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:\\u043c\\u0438\\u043d\\u0443\\u0442(?:\\u044b|\\u0430)?|\\u043c\\u0438\\u043d)', 'gi');

const parseMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;

  const normalized = value
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/[;,]/g, ' ')
    .trim();

  let minutes = 0;
  let matched = false;

  let match;
  while ((match = hourRegex.exec(normalized)) !== null) {
    const amount = parseFloat(match[1].replace(',', '.'));
    if (!Number.isNaN(amount)) {
      minutes += amount * 60;
      matched = true;
    }
  }

  while ((match = minuteRegex.exec(normalized)) !== null) {
    const amount = parseFloat(match[1].replace(',', '.'));
    if (!Number.isNaN(amount)) {
      minutes += amount;
      matched = true;
    }
  }

  if (matched) {
    return Math.round(minutes);
  }

  const fallbackNumber = normalized.match(/\d+/);
  return fallbackNumber ? parseInt(fallbackNumber[0], 10) : null;
};

const parseQuantity = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;

  const normalized = value.replace(',', '.').trim();
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const first = parseFloat(rangeMatch[1]);
    const second = parseFloat(rangeMatch[2]);
    if (!Number.isNaN(first) && !Number.isNaN(second)) {
      return Math.round(((first + second) / 2) * 100) / 100;
    }
  }

  const singleMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const number = parseFloat(singleMatch[1]);
    if (!Number.isNaN(number)) {
      return number;
    }
  }

  return null;
};

const parseServings = (groups) => {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  const name = groups[0]?.name;
  if (typeof name !== 'string') return null;
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const hashStringToInt = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const parseExternalId = (source) => {
  if (typeof source !== 'string') return null;
  const match = source.match(/\/(\d+)(?:-[^/]*)?\/?$/);
  if (match) {
    return parseInt(match[1], 10);
  }

  const slugMatch = source.match(/\/([^/]+)\/?$/);
  if (slugMatch) {
    return hashStringToInt(slugMatch[1]);
  }

  return null;
};

const joinNonEmpty = (parts, separator = ' ') =>
  parts
    .map((part) => part?.trim())
    .filter((part) => part && part.length > 0)
    .join(separator);

const buildIngredientEntry = (item, groupName) => {
  const quantity = parseQuantity(item.value);
  const unit = item.type?.trim() || null;
  const note = item.notes?.trim();

  const baseName = item.name?.trim() || 'Ингредиент';
  const qualifiedName =
    groupName && !groupName.toLowerCase().includes('ингредиент')
      ? `${groupName.trim()}: ${baseName}`
      : baseName;

  let name = qualifiedName;
  if (quantity == null && item.value) {
    const extra = joinNonEmpty([item.value, unit]);
    name = joinNonEmpty([name, extra], ' — ');
  }

  if (note) {
    name = joinNonEmpty([name, note], '. ');
  }

  return {
    name,
    quantity,
    unit: quantity != null ? unit : null,
  };
};

const buildRecipePayload = (data) => {
  const cookingTimeMinutes =
    parseMinutes(data.cooktime) ?? parseMinutes(data.preparetime) ?? null;
  const servings = parseServings(data.ingredients);
  const externalId = parseExternalId(data.source);

  const ingredients =
    data.ingredients?.flatMap((group) =>
      group.list?.map((item) => buildIngredientEntry(item, group.name)) ?? [],
    ) ?? [];

  const steps =
    data.instruction?.map((step, index) => ({
      stepOrder: index + 1,
      description: joinNonEmpty(
        [
          step.text?.trim() || 'Шаг',
          step.image ? `См. изображение: ${step.image}` : null,
        ],
        '\n',
      ),
    })) ?? [];

  return {
    title: data.title?.trim() || 'Без названия',
    description: joinNonEmpty([data.description, data.note], '\n\n') || null,
    imageUrl: data.poster || null,
    cookingTimeMinutes,
    calories: null,
    servings,
    rating: null,
    externalId,
    externalSource: DEFAULT_SOURCE,
    ingredients,
    steps,
  };
};

const collectJsonFiles = async (root) => {
  const items = await fs.readdir(root, { withFileTypes: true });
  const results = [];

  for (const entry of items) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectJsonFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
};

const importRecipe = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);
  const recipe = buildRecipePayload(data);

  if (!recipe.externalId) {
    console.warn(`Skip ${filePath}: cannot determine externalId`);
    return { imported: false, reason: 'missing_external_id' };
  }

  const existing = await prisma.recipe.findUnique({
    where: {
      externalSource_externalId: {
        externalSource: recipe.externalSource,
        externalId: recipe.externalId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { imported: false, reason: 'already_exists' };
  }

  await prisma.recipe.create({
    data: {
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      cookingTimeMinutes: recipe.cookingTimeMinutes,
      calories: recipe.calories,
      servings: recipe.servings,
      rating: recipe.rating,
      externalId: recipe.externalId,
      externalSource: recipe.externalSource,
      authorId: AUTHOR_ID,
      ingredients: {
        create: recipe.ingredients,
      },
      steps: {
        create:
          recipe.steps.length > 0
            ? recipe.steps
            : [
                {
                  stepOrder: 1,
                  description: 'Следуйте инструкции на сайте источника.',
                },
              ],
      },
    },
  });

  return { imported: true };
};

async function main() {
  if (!Number.isInteger(AUTHOR_ID) || AUTHOR_ID <= 0) {
    throw new Error(
      'Set IMPORT_AUTHOR_ID env variable to the numeric id of the author user.',
    );
  }

  const files = await collectJsonFiles(RECIPES_ROOT);
  console.log(`Found ${files.length} recipe files. Starting import...`);

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const result = await importRecipe(file);
      if (result?.imported) {
        imported += 1;
        if (imported % 100 === 0) {
          console.log(`Imported ${imported} recipes so far...`);
        }
      } else {
        skipped += 1;
      }
    } catch (error) {
      skipped += 1;
      console.error(`Failed to import ${file}:`, error.message);
    }
  }

  console.log(
    `Import finished. Imported: ${imported}, failed/skipped: ${skipped}`,
  );
}

main()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
