const prisma = require('../prismaClient');
const spoonacularService = require('../services/spoonacularService');

const toIntOrNull = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getRecipes = async (req, res) => {
  try {
    const { query, search, ingredients, page = 1, pageSize = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const take = parseInt(pageSize, 10);

    const where = {};
    const searchTerm = search || query;

    if (searchTerm) {
      where.OR = [
        {
          title: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          ingredients: {
            some: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          steps: {
            some: {
              description: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    if (ingredients) {
      const ingredientsList = ingredients
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (ingredientsList.length > 0) {
        const ingredientFilters = ingredientsList.map((ingredientName) => ({
          ingredients: {
            some: {
              name: {
                contains: ingredientName,
                mode: 'insensitive',
              },
            },
          },
        }));

        where.AND = [
          ...(where.AND || []),
          { OR: ingredientFilters },
        ];
      }
    }

    const recipes = await prisma.recipe.findMany({
      where,
      skip,
      take,
      include: {
        author: { select: { id: true, username: true, email: true } },
        favorites: {
          where: { userId: req.userId || 0 },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.recipe.count({ where });

    const formattedRecipes = recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      cookingTimeMinutes: recipe.cookingTimeMinutes,
      calories: recipe.calories,
      servings: recipe.servings,
      rating: recipe.rating,
      externalId: recipe.externalId,
      externalSource: recipe.externalSource,
      isFavorite: recipe.favorites.length > 0,
      author: recipe.author
        ? {
            id: recipe.author.id,
            username: recipe.author.username,
            email: recipe.author.email ?? null,
          }
        : null,
    }));

    res.json({
      recipes: formattedRecipes,
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ message: 'Failed to fetch recipes' });
  }
};

const getRecipeById = async (req, res) => {
  try {
    const recipeId = toIntOrNull(req.params.id);
    if (recipeId === null) {
      return res.status(400).json({ message: 'Invalid recipe id' });
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        author: { select: { id: true, username: true, email: true } },
        ingredients: { select: { id: true, name: true, quantity: true, unit: true } },
        steps: { orderBy: { stepOrder: 'asc' }, select: { id: true, stepOrder: true, description: true } },
        favorites: { where: { userId: req.userId || 0 }, select: { id: true } },
      },
    });

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const formattedRecipe = {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      cookingTimeMinutes: recipe.cookingTimeMinutes,
      calories: recipe.calories,
      servings: recipe.servings,
      rating: recipe.rating,
      externalId: recipe.externalId,
      externalSource: recipe.externalSource,
      isFavorite: recipe.favorites.length > 0,
      author: recipe.author,
      ingredients: recipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
      steps: recipe.steps.map((step) => ({
        id: step.id,
        order: step.stepOrder,
        description: step.description,
      })),
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    };

    res.json({
      recipe: {
        id: formattedRecipe.id,
        title: formattedRecipe.title,
        description: formattedRecipe.description,
        imageUrl: formattedRecipe.imageUrl,
        cookingTimeMinutes: formattedRecipe.cookingTimeMinutes,
        calories: formattedRecipe.calories,
        servings: formattedRecipe.servings,
        rating: formattedRecipe.rating,
        externalId: formattedRecipe.externalId,
        externalSource: formattedRecipe.externalSource,
        isFavorite: formattedRecipe.isFavorite,
        author: formattedRecipe.author,
        createdAt: formattedRecipe.createdAt,
        updatedAt: formattedRecipe.updatedAt,
      },
      ingredients: formattedRecipe.ingredients,
      steps: formattedRecipe.steps,
    });
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ message: 'Failed to fetch recipe' });
  }
};

const createRecipe = async (req, res) => {
  try {
    const { title, description, imageUrl, cookingTimeMinutes, calories, servings, ingredients, steps } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!ingredients || ingredients.length === 0) {
      return res.status(400).json({ message: 'At least one ingredient is required' });
    }

    if (!steps || steps.length === 0) {
      return res.status(400).json({ message: 'At least one step is required' });
    }

    const recipe = await prisma.recipe.create({
      data: {
        title,
        description,
        imageUrl,
        cookingTimeMinutes: cookingTimeMinutes ? parseInt(cookingTimeMinutes, 10) : null,
        calories: calories ? parseInt(calories, 10) : null,
        servings: servings ? parseInt(servings, 10) : null,
        authorId: req.userId,
        ingredients: {
          create: ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantity: ingredient.quantity ? parseFloat(ingredient.quantity) : null,
            unit: ingredient.unit,
          })),
        },
        steps: {
          create: steps.map((step, index) => ({
            stepOrder: index + 1,
            description: step.description,
          })),
        },
      },
      include: {
        ingredients: true,
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    res.status(201).json(recipe);
  } catch (error) {
    console.error('Create recipe error:', error);
    res.status(500).json({ message: 'Failed to create recipe' });
  }
};

const updateRecipe = async (req, res) => {
  try {
    const recipeId = toIntOrNull(req.params.id);
    if (recipeId === null) {
      return res.status(400).json({ message: 'Invalid recipe id' });
    }
    const { title, description, imageUrl, cookingTimeMinutes, calories, servings } = req.body;

    const existingRecipe = await prisma.recipe.findUnique({ where: { id: recipeId } });

    if (!existingRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (existingRecipe.authorId !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updatedRecipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        title,
        description,
        imageUrl,
        cookingTimeMinutes: cookingTimeMinutes ? parseInt(cookingTimeMinutes, 10) : null,
        calories: calories ? parseInt(calories, 10) : null,
        servings: servings ? parseInt(servings, 10) : null,
      },
      include: {
        ingredients: true,
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    res.json(updatedRecipe);
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({ message: 'Failed to update recipe' });
  }
};

const deleteRecipe = async (req, res) => {
  try {
    const recipeId = toIntOrNull(req.params.id);

    if (recipeId === null) {
      return res.status(400).json({ message: 'Invalid recipe id' });
    }

    const existingRecipe = await prisma.recipe.findUnique({ where: { id: recipeId } });

    if (!existingRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (existingRecipe.authorId !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await prisma.recipe.delete({ where: { id: recipeId } });

    res.json({ message: 'Recipe removed' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ message: 'Failed to delete recipe' });
  }
};

const importFromSpoonacular = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { query, number = 10 } = req.body || {};
    const limit = Math.min(Math.max(parseInt(number, 10) || 10, 1), 20);

    const externalRecipes = await spoonacularService.fetchRecipes({ query, number: limit });
    if (!externalRecipes.length) {
      return res.json({ imported: 0, skipped: 0 });
    }

    const createdIds = [];
    let skipped = 0;

    for (const externalRecipe of externalRecipes) {
      let existing = null;
      if (externalRecipe.externalId != null) {
        existing = await prisma.recipe.findUnique({
          where: {
            externalSource_externalId: {
              externalSource: externalRecipe.externalSource || 'spoonacular',
              externalId: externalRecipe.externalId,
            },
          },
        });
      }

      if (!existing) {
        existing = await prisma.recipe.findFirst({
          where: {
            title: externalRecipe.title,
            authorId: req.userId,
          },
        });
      }

      if (existing) {
        skipped += 1;
        continue;
      }

      const steps = externalRecipe.steps.length > 0
        ? externalRecipe.steps
        : [{ order: 1, description: 'Follow the instructions on the source page.' }];

      const created = await prisma.recipe.create({
        data: {
          title: externalRecipe.title,
          description: externalRecipe.description,
          imageUrl: externalRecipe.imageUrl,
          cookingTimeMinutes: externalRecipe.cookingTimeMinutes,
          calories: externalRecipe.calories,
          servings: externalRecipe.servings,
          rating: externalRecipe.rating,
          externalId: externalRecipe.externalId ?? null,
          externalSource: externalRecipe.externalSource || 'spoonacular',
          authorId: req.userId,
          ingredients: {
            create: externalRecipe.ingredients.map((ingredient) => ({
              name: ingredient.name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            })),
          },
          steps: {
            create: steps.map((step, index) => ({
              stepOrder: step.order ?? index + 1,
              description: step.description || 'Step',
            })),
          },
        },
      });

      createdIds.push(created.id);
    }

    res.json({
      imported: createdIds.length,
      skipped,
      recipeIds: createdIds,
    });
  } catch (error) {
    console.error('Import recipes error:', error);
    res.status(500).json({ message: 'Failed to import recipes', error: error.message });
  }
};

module.exports = {
  getRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  importFromSpoonacular,
};
