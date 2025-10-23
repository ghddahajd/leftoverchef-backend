const prisma = require('../prismaClient');

const toModel = (favorite) => ({
  id: favorite.id,
  recipeId: favorite.recipeId,
  userId: favorite.userId,
  createdAt: favorite.createdAt.getTime(),
});

const getFavorites = async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.userId },
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            cookingTimeMinutes: true,
            calories: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      favorites.map((favorite) => ({
        ...toModel(favorite),
        recipe: favorite.recipe,
      }))
    );
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ message: 'Failed to fetch favorites' });
  }
};

const addFavorite = async (req, res) => {
  try {
    const { recipeId } = req.body;

    if (!recipeId) {
      return res.status(400).json({ message: 'recipeId is required' });
    }

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_recipeId: {
          userId: req.userId,
          recipeId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ message: 'Recipe already in favorites' });
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: req.userId,
        recipeId,
      },
    });

    res.status(201).json(toModel(favorite));
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ message: 'Failed to add favorite' });
  }
};

const removeFavorite = async (req, res) => {
  try {
    const { recipeId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_recipeId: {
          userId: req.userId,
          recipeId: parseInt(recipeId, 10),
        },
      },
    });

    if (!favorite) {
      return res.status(404).json({ message: 'Favorite not found' });
    }

    await prisma.favorite.delete({ where: { id: favorite.id } });

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ message: 'Failed to remove favorite' });
  }
};

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite,
};
