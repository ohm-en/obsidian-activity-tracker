export default [
  {
    input: "src/main-duration-tracking.js",
    output: {
      file: "examples/template_track_duration.md",
      format: "cjs",
      banner: "<%-*",
      footer: "_%>",
    },
  },
  {
    input: "src/main-interval-tracking.js",
    output: {
      file: "examples/template_track_interval.md",
      format: "cjs",
      banner: "<%-*",
      footer: "_%>",
    },
  },
];
