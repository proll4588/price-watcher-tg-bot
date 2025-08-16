const fs = require("fs");
const path = require("path");

// Функция для замены алиасов на относительные пути
function replaceAliases(content, filePath) {
  const dir = path.dirname(filePath);
  const srcDir = path.resolve("src");

  // Заменяем @/ на относительные пути
  return content.replace(/@\/([^'"]*)/g, (match, importPath) => {
    const targetPath = path.resolve(srcDir, importPath);
    const relativePath = path.relative(dir, targetPath);

    // Убираем расширение .ts если есть
    const cleanPath = relativePath.replace(/\.ts$/, "");

    // Добавляем ./ если путь не начинается с ../
    return cleanPath.startsWith(".") ? cleanPath : `./${cleanPath}`;
  });
}

// Функция для обработки файла
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const newContent = replaceAliases(content, filePath);

    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Обработан: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при обработке ${filePath}:`, error.message);
  }
}

// Функция для рекурсивного обхода директории
function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
      processFile(filePath);
    }
  }
}

// Запускаем обработку
console.log("🔄 Начинаю замену алиасов на относительные пути...");
processDirectory("src");
console.log("✅ Замена завершена!");
