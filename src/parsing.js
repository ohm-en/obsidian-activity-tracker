export const splitOnFrontMatter = function ({ from: text }) {
  const regex = /(?<yaml>^---\s*[\s\S]*?---[ 	]*)/;
  const match = text.match(regex);
  if (match) {
    const yaml = match[1];
    const restOfContent = text.replace(regex, "");
    return [yaml, restOfContent];
  }

  return ["", text];
};
