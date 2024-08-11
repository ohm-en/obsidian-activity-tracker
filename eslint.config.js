import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    languageOptions: {
      globals: globals.browser,
    },
    globals: {
      moment: "readonly",
    },
  },
  pluginJs.configs.recommended,
];
