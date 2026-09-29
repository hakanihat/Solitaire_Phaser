module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { sourceType: "module", ecmaVersion: 2022, project: "tsconfig.json", tsconfigRootDir: __dirname },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    eqeqeq: "error",
    curly: "error",
  },
  overrides: [{ files: ["scripts/**/*.ts"], rules: { "no-console": "off" } }],
  ignorePatterns: ["node_modules/", "dist/", "android/", "vite.config.ts", ".eslintrc.cjs"],
};
