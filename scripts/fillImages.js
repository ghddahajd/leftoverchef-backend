import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// 🔐 Конфиги
const DATABASE_URL = "postgresql://neondb_owner:npg_Hn3ywJW0YXAm@ep-tiny-sun-ad05bzgf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&schema=public";
const PEXELS_API_KEY = "QZFpI5oyz7D0cSlwKRjQWDc6rLp6nyEcjXVDHkz7Zu4Mu45E2Ho7N3eX";
const UNSPLASH_ACCESS_KEY = "pOuYicmlU2HM1z96ZNC1NMX2bNy9T7CMc8LD7I_QXf0";
const PIXABAY_API_KEY = "53019284-09f6a22847138b16b4df7164b";
const SPOONACULAR_API_KEY = "1f33eb4ef7b0441dbdac509e139676ba";

// 📦 Проставляем переменные окружения
process.env.DATABASE_URL = DATABASE_URL;

// 🧩 Prisma init
const prisma = new PrismaClient();

const BATCH_SIZE = 100;
const DELAY = 1200;

const logDir = path.resolve("./logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logFile = path.join(logDir, `fillImages_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
const log = (text) => {
  console.log(text);
  fs.appendFileSync(logFile, text + "\n");
};

// 🔍 Улучшенная функция для создания поискового запроса
function makeQuery(title) {
  const cleaned = title
    .toLowerCase()
    .replace(/\b(с|из|на|в|и|под|для|очень|классический|домашний|нежный|вкусный|легкий|простой)\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length > 2)
    .slice(0, 3)
    .join(" ");
  
  return cleaned || title.split(/[^\p{L}\p{N}]+/u).slice(0, 2).join(" ");
}

// 🎨 API #1: Unsplash
async function getUnsplashPhoto(query) {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${UNSPLASH_ACCESS_KEY}&orientation=landscape&per_page=1`
    );
    const data = await res.json();
    return data.results?.[0]?.urls?.regular || null;
  } catch (err) {
    log(`🔴 Unsplash error for "${query}": ${err.message}`);
    return null;
  }
}

// 🎨 API #2: Pexels
async function getPexelsPhoto(query) {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    const data = await res.json();
    return data.photos?.[0]?.src?.medium || null;
  } catch (err) {
    log(`🔴 Pexels error for "${query}": ${err.message}`);
    return null;
  }
}

// 🎨 API #3: Pixabay
async function getPixabayPhoto(query) {
  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&safesearch=true`
    );
    const data = await res.json();
    return data.hits?.[0]?.webformatURL || null;
  } catch (err) {
    log(`🔴 Pixabay error for "${query}": ${err.message}`);
    return null;
  }
}

// 🍕 API #4: Spoonacular (специально для еды!)
async function getSpoonacularPhoto(query) {
  try {
    const res = await fetch(
      `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(query)}&apiKey=${SPOONACULAR_API_KEY}&number=1&addRecipeInformation=true`
    );
    const data = await res.json();
    return data.results?.[0]?.image || null;
  } catch (err) {
    log(`🔴 Spoonacular error for "${query}": ${err.message}`);
    return null;
  }
}

async function main() {
  const recipes = await prisma.recipe.findMany({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: "" },
        { imageUrl: { contains: "vkuso.ru" } },
        { imageUrl: { contains: "eda.ru" } },
      ],
    },
    select: { id: true, title: true },
    take: BATCH_SIZE,
  });

  log(`🔍 Найдено ${recipes.length} рецептов для обновления`);

  for (const [i, r] of recipes.entries()) {
    const query = makeQuery(r.title);
    log(`🔎 [${i + 1}/${recipes.length}] Запрос: "${query}" для "${r.title}"`);
    
    // 🎯 Пробуем все 4 источника по очереди
    let photo = await getSpoonacularPhoto(query); // Сначала Spoonacular (для еды лучше всего)
    if (!photo) photo = await getUnsplashPhoto(query);
    if (!photo) photo = await getPexelsPhoto(query);
    if (!photo) photo = await getPixabayPhoto(query);

    if (photo) {
      await prisma.recipe.update({ where: { id: r.id }, data: { imageUrl: photo } });
      log(`✅ [${i + 1}] ${r.title} → ${photo}`);
    } else {
      log(`⚠️ [${i + 1}] ${r.title} → фото не найдено во всех источниках`);
    }

    await new Promise((r) => setTimeout(r, DELAY));
  }

  log("🎉 Прогон завершён. Проверь log-файл для деталей.");
  await prisma.$disconnect();
}

main().catch((e) => {
  log("❌ Ошибка: " + e.message);
  prisma.$disconnect();
});