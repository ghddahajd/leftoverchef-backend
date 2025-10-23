const prisma = require('../prismaClient');

const getFridgeItems = async (req, res) => {
  try {
    const items = await prisma.fridgeItem.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    const formattedItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      expiresAt: item.expiresAt ? item.expiresAt.getTime() : null,
      createdAt: item.createdAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
    }));

    res.json(formattedItems);
  } catch (error) {
    console.error('Get fridge items error:', error);
    res.status(500).json({ message: 'Failed to fetch fridge items' });
  }
};

const addFridgeItem = async (req, res) => {
  try {
    const { name, quantity, category, expiresAt } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    if (!quantity) {
      return res.status(400).json({ message: 'Quantity is required' });
    }

    const item = await prisma.fridgeItem.create({
      data: {
        name,
        quantity,
        category,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        userId: req.userId,
      },
    });

    const formattedItem = {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      expiresAt: item.expiresAt ? item.expiresAt.getTime() : null,
      createdAt: item.createdAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
    };

    res.status(201).json(formattedItem);
  } catch (error) {
    console.error('Add fridge item error:', error);
    res.status(500).json({ message: 'Failed to add fridge item' });
  }
};

const updateFridgeItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, category, expiresAt } = req.body;

    const existingItem = await prisma.fridgeItem.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (existingItem.userId !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updatedItem = await prisma.fridgeItem.update({
      where: { id: parseInt(id, 10) },
      data: {
        name,
        quantity,
        category,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    const formattedItem = {
      id: updatedItem.id,
      name: updatedItem.name,
      quantity: updatedItem.quantity,
      category: updatedItem.category,
      expiresAt: updatedItem.expiresAt ? updatedItem.expiresAt.getTime() : null,
      createdAt: updatedItem.createdAt.getTime(),
      updatedAt: updatedItem.updatedAt.getTime(),
    };

    res.json(formattedItem);
  } catch (error) {
    console.error('Update fridge item error:', error);
    res.status(500).json({ message: 'Failed to update fridge item' });
  }
};

const deleteFridgeItem = async (req, res) => {
  try {
    const { id } = req.params;

    const existingItem = await prisma.fridgeItem.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (existingItem.userId !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await prisma.fridgeItem.delete({
      where: { id: parseInt(id, 10) },
    });

    res.json({ message: 'Item removed' });
  } catch (error) {
    console.error('Delete fridge item error:', error);
    res.status(500).json({ message: 'Failed to delete fridge item' });
  }
};

module.exports = {
  getFridgeItems,
  addFridgeItem,
  updateFridgeItem,
  deleteFridgeItem,
};
