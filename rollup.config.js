//import { writeFileSync } from "fs";
//import { terser } from "rollup-plugin-terser";

// export default {
//   input: "src/main.js",
//   output: {
//     file: "dist/bundle.js",
//     format: "cjs",
//     plugins: [terser()],
//   },
//   plugins: [
//     {
//       name: "generate-md",
//       generateBundle(outputOptions, bundle) {
//         const { code } = bundle["bundle.js"];
//         const jsContent = "<%-*\n" + code + "_%>";
//         writeFileSync("dist/TrackActivities.md", jsContent);
//       },
//     },
//   ],
// };

export default {
  input: "src/main.js",
  output: {
    file: "examples/template.md",
    format: "cjs",
    banner: "<%-*",
    footer: "_%>",
  },
};
