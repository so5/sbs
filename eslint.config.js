import globals from "globals";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import eslintPluginChaiFriendly from "eslint-plugin-chai-friendly";
import eslintPluginChaiExpect from "eslint-plugin-chai-expect";

// mimic CommonJS variables -- not needed if using CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname
});

export default [
  // Global configuration
  {
    ignores: ["coverage-report.lcov", "node_modules/"]
  },
  ...compat.extends("standard"),
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.es2021,
        ...globals.node
      }
    },
    rules: {
      semi: [
        "error",
        "always"
      ],
      quotes: [
        "error",
        "double"
      ]
    }
  },
  // Test configuration
  {
    files: ["test/**/*.js"],
    plugins: {
      "chai-friendly": eslintPluginChaiFriendly,
      "chai-expect": eslintPluginChaiExpect
    },
    languageOptions: {
      globals: {
        ...globals.mocha
      }
    },
    rules: {
      "no-unused-expressions": "off",
      "chai-friendly/no-unused-expressions": "error"
    }
  }
];
