import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "public"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    // Campaign controls gate on the detail's capabilities (design 0.29): only
    // features/campaigns/capabilities.ts knows roles and permission codes.
    files: ["src/features/**/*.{ts,tsx}"],
    ignores: ["src/features/campaigns/capabilities.ts", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name=/^campaign$/][property.name='role']",
          message: "Gate on capabilities (design 0.29), not on the viewer's role.",
        },
        {
          selector:
            "CallExpression[callee.property.name='includes'][arguments.0.value=/^(add_custom|manage_)/]",
          message: "Gate on capabilities (design 0.29), not on permission codes.",
        },
      ],
    },
  },
);
