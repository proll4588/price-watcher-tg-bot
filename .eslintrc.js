module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "prettier", // Отключает правила ESLint, которые конфликтуют с Prettier
  ],
  rules: {
    "prettier/prettier": "error", // Ошибки при нарушении правил Prettier
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "warn",
    "prefer-const": "error",
    "no-var": "error",
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ["dist/", "node_modules/", "*.js"],
};
