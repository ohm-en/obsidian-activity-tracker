export default [
  {
    input: "src/main-plugin.js",
    external: ['obsidian'],
    output: {
      file: "example-vault/.obsidian/plugins/src/main.js",
      format: "cjs",
    },
  },
];
