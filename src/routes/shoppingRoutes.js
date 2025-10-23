const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const shoppingController = require('../controllers/shoppingController');

const router = express.Router();

router.get('/', authMiddleware, shoppingController.getShoppingItems);
router.post('/', authMiddleware, shoppingController.addShoppingItem);
router.patch('/:id', authMiddleware, shoppingController.updateShoppingItem);
router.delete('/:id', authMiddleware, shoppingController.deleteShoppingItem);

module.exports = router;
