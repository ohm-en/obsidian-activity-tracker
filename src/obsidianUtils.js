/*
 * Contains any utility functions
 * used for interacting with any
 * ObsidianMD or accociated plugins
 * NOTE: Will not work outside of ObsidianMD's runtime
 */

export const spawnUserNotice = function ({ message }) {
  new Notice(message);
};

const getTFile = function ({ from: filePath }) {
  const tFile = app.vault.getAbstractFileByPath(filePath);
  return tFile;
};

export const isCursor = function (n) {
  if (app.isMobile === false) {
    return `\<%tp.file.cursor(${n})%\>`;
  }
  return "";
};

export const getDailyNote = async function ({
  from_date = moment(),
  dailyNotePathSchema = "[Logs]/YYYY/MM - MMMM (Y)/Y-MM-DD[.md]",
}) {
  const notePath = from_date.format(dailyNotePathSchema);
  const tFile = getTFile({ from: notePath });
  let text = "";

  const metadata = (await app.metadataCache.getFileCache(tFile)) || {};
  const yaml = metadata.frontmatter || {};

  const append = async function ({ text }) {
    await app.vault.append(tFile, text);
  };

  const modify = async function ({ newContent }) {
    await app.vault.modify(tFile, newContent);
  };

  const process = async function (callback) {
    return app.vault.process(tFile, callback);
  };

  const refresh = async function () {
    text = await app.vault.read(tFile);
  };

  await refresh();

  return Object.freeze({
    name: tFile.basename,
    text,
    yaml,
    process,
    refresh,
    append,
    modify,
  });
};

export const getWorkflows = async function ({ from: path }) {
  const notes = await app.vault.fileMap[path].children;
  const metadataArray = notes.map(function (note) {
    const noteName = note.basename;
    // TODO: is note itself a tfile?
    const tFile = getTFile({ from: note.path });
    const fileCache = app.metadataCache.getFileCache(tFile) || {};
    const yamlMetadata = fileCache.frontmatter || {};
    const workflow = {
      name: noteName,
      attributes: yamlMetadata["attributes"] || [],
    };
    return workflow;
  });
  return metadataArray;
};

export const promptSelection = async function ({ of: items }) {
  // TODO: assert items = { label, value }
  const selection = await tp.system.suggester(
    items.label,
    items.value || items.label,
    true,
  );
  return selection;
};

export const promptInput = async function ({
  label,
  defaultAnswer,
  placeholder = "",
}) {
  const quickAddInputPrompt = app?.plugins?.plugins?.quickadd?.api?.inputPrompt;
  if (quickAddInputPrompt) {
    const input = await quickAddInputPrompt(label, placeholder, defaultAnswer);
    return input;
  } else {
    const input = await tp.system.prompt(label, defaultAnswer, true);
    return input;
  }
};
