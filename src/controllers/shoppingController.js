const prisma = require('../prismaClient');

const parseQuantity = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeUnit = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toModel = (item) => ({
  id: item.id,
  name: item.name,
  quantity: item.quantity,
  unit: item.unit ?? null,
  isCompleted: item.isCompleted,
  createdAt: item.createdAt.getTime(),
  updatedAt: item.updatedAt.getTime(),
});

const getShoppingItems = async (req, res) => {
  try {
    const items = await prisma.shoppingItem.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(items.map(toModel));
  } catch (error) {
    console.error('Get shopping items error:', error);
    res.status(500).json({ message: 'Failed to fetch shopping items' });
  }
};

const addShoppingItem = async (req, res) => {
  try {
    const { name, quantity, unit, isCompleted } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    const item = await prisma.shoppingItem.create({
      data: {
        name,
        quantity: parseQuantity(quantity),
        unit: normalizeUnit(unit),
        isCompleted: typeof isCompleted === 'boolean' ? isCompleted : false,
        userId: req.userId,
      },
    });

    res.status(201).json(toModel(item));
  } catch (error) {
    console.error('Add shopping item error:', error);
    res.status(500).json({ message: 'Failed to add shopping item' });
  }
};

const updateShoppingItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, unit, isCompleted } = req.body;

    const itemId = parseInt(id, 10);
    const existingItem = await prisma.shoppingItem.findUnique({ where: { id: itemId } });

    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (existingItem.userId !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updatedItem = await prisma.shoppingItem.update({
      where: { id: itemId },
      data: {
        name: name ?? existingItem.name,
        quantity: quantity !== undefined ? parseQuantity(quantity) : existingItem.quantity,
        unit: unit !== undefined ? normalizeUnit(unit) : existingItem.unit,
        isCompleted:
          typeof isCompleted === 'boolean' ? isCompleted : existingItem.isCompleted,
      },
    });

    res.json(toModel(updatedItem));
  } catch (error) {
    console.error('Update shopping item error:', error);
    res.status(500).json({ message: 'Failed to update shopping item' });
  }
};

const deleteShoppingItem = async (req, res) => {
  try {
    const itemId = parseInt(req.params.id, 10);

    const existingItem = await prisma.shoppingItem.findUnique({ where: { id: itemId } });

    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (existingItem.userId !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await prisma.shoppingItem.delete({ where: { id: itemId } });

    res.json({ message: 'Item removed' });
  } catch (error) {
    console.error('Delete shopping item error:', error);
    res.status(500).json({ message: 'Failed to delete shopping item' });
  }
};

module.exports = {
  getShoppingItems,
  addShoppingItem,
  updateShoppingItem,
  deleteShoppingItem,
};
