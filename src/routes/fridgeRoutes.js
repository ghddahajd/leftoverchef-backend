const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const fridgeController = require('../controllers/fridgeController');

const router = express.Router();

router.get('/', authMiddleware, fridgeController.getFridgeItems);
router.post('/', authMiddleware, fridgeController.addFridgeItem);
router.patch('/:id', authMiddleware, fridgeController.updateFridgeItem);
router.delete('/:id', authMiddleware, fridgeController.deleteFridgeItem);

module.exports = router;
