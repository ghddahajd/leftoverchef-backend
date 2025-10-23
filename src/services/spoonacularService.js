const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://api.spoonacular.com';

const mapHtmlToText = (html) =>
  html?.replace(/<[^>]*>/g, ' ')
    ?.replace(/&[^;]+;/g, ' ')
    ?.replace(/\s+/g, ' ')
    ?.trim() ?? null;

const getCalories = (nutrition) => {
  if (!nutrition?.nutrients) return null;
  const calories = nutrition.nutrients.find((nutrient) => nutrient.name === 'Calories');
  if (!calories || typeof calories.amount !== 'number') {
    return null;
  }
  return Math.round(calories.amount);
};

const mapToRating = (score) => {
  if (typeof score !== 'number') return null;
  const rating = Math.max(0, Math.min(5, (score / 100) * 5));
  return Math.round(rating * 10) / 10;
};

const mapRecipe = (recipe) => ({
  externalId: recipe.id,
  externalSource: 'spoonacular',
  title: recipe.title,
  description: mapHtmlToText(recipe.summary),
  imageUrl: recipe.image,
  cookingTimeMinutes: recipe.readyInMinutes ?? null,
  calories: getCalories(recipe.nutrition),
  servings: recipe.servings ?? null,
  rating: mapToRating(recipe.spoonacularScore ?? recipe.healthScore ?? recipe.weightWatcherSmartPoints),
  ingredients: (recipe.extendedIngredients || []).map((ingredient) => ({
    name: ingredient.originalName || ingredient.name || 'Ingredient',
    quantity: typeof ingredient.amount === 'number' ? ingredient.amount : null,
    unit: ingredient.unit || ingredient.unitShort || null,
  })),
  steps: (recipe.analyzedInstructions?.[0]?.steps || []).map((step) => ({
    order: step.number,
    description: step.step,
  })),
});

const fetchRecipes = async ({ query, number = 10, offset = 0 }) => {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    throw new Error('SPOONACULAR_API_KEY is not configured');
  }

  const params = new URLSearchParams({
    number: String(number),
    offset: String(offset),
    addRecipeInformation: 'true',
    fillIngredients: 'true',
  });

  if (query) {
    params.set('query', query);
  }

  const response = await fetch(`${BASE_URL}/recipes/complexSearch?${params.toString()}&apiKey=${apiKey}`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spoonacular API error: ${response.status} ${response.statusText} - ${body}`);
  }

  const payload = await response.json();
  const results = payload.results || [];
  return results.map(mapRecipe);
};

module.exports = {
  fetchRecipes,
};
