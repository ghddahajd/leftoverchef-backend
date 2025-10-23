const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const favoritesController = require('../controllers/favoritesController');

const router = express.Router();

router.get('/', authMiddleware, favoritesController.getFavorites);
router.post('/', authMiddleware, favoritesController.addFavorite);
router.delete('/:recipeId', authMiddleware, favoritesController.removeFavorite);

module.exports = router;
