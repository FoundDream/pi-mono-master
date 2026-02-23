import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: [
      "node_modules/",
      "dist/",
      "doc_build/",
      ".rspress/",
      "*.config.js",
      "*.config.ts",
    ],
  },
);
