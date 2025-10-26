const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const recipesRoutes = require('./routes/recipesRoutes');
const fridgeRoutes = require('./routes/fridgeRoutes');
const shoppingRoutes = require('./routes/shoppingRoutes');
const favoritesRoutes = require('./routes/favoritesRoutes');

const syncSequences = require('./utils/syncSequences');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/recipes', recipesRoutes);
app.use('/fridge', fridgeRoutes);
app.use('/shopping', shoppingRoutes);
app.use('/favorites', favoritesRoutes);

app.get('/health', (req, res) => {
  res.json({
    message: 'LeftoverChef API',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      recipes: '/recipes',
      fridge: '/fridge',
      shopping: '/shopping',
      favorites: '/favorites',
    },
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

const startServer = async () => {
  await syncSequences();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
