const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const recipesController = require('../controllers/recipesController');

const router = express.Router();

router.get('/', recipesController.getRecipes);
router.post('/import', authMiddleware, recipesController.importFromSpoonacular);
router.get('/:id', recipesController.getRecipeById);
router.post('/', authMiddleware, recipesController.createRecipe);
router.put('/:id', authMiddleware, recipesController.updateRecipe);
router.delete('/:id', authMiddleware, recipesController.deleteRecipe);

module.exports = router;
