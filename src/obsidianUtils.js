/*
 * Contains any utility functions
 * used for interacting with any
 * ObsidianMD or accociated plugins
 * NOTE: Will not work outside of ObsidianMD's runtime
 */

import { assert, isNonEmptyArray } from "./utils.js";
import { SuggestModal, Modal, Setting } from "obsidian";

export const spawnUserNotice = function ({ message } = {}) {
  new Notice(message);
};

const getTFile = function ({ from: filePath } = {}) {
  const tFile = app.vault.getAbstractFileByPath(filePath);
  return tFile;
};

// TODO: This should be re-implemented without leveraging tp.
export const isCursor = function (n) {
  if (app.isMobile === false) {
    return `\<%tp.file.cursor(${n})%\>`;
  }
  return "";
};

export const getDailyNote = async function ({
  from_date = moment(),
  dailyNotePathSchema = "[Logs]/YYYY/MM - MMMM (Y)/Y-MM-DD[.md]",
} = {}) {
  const notePath = from_date.format(dailyNotePathSchema);
  const tFile = getTFile({ from: notePath });

  // TODO: Create isTFile typeguard
  assert(tFile, `Daily at '${notePath}' could not be found`);

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
    text = await getLatestFileContent(tFile);
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

const ensureFolderExists = async function (path) {
  const folder = app.vault.getAbstractFileByPath(path);

  if (!folder) {
    await app.vault.createFolder(path);
    return app.vault.getAbstractFileByPath(path);
  }

  return folder;
};

export const getWorkflows = async function ({ from: path } = {}) {
  const folder = await ensureFolderExists(path);
  const notes = folder.children;
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

// TODO: Probably move the model
class SelectionModal extends SuggestModal {
  constructor(app, items) {
    super(app);
    this.items = items; // expected: [{ label, value }, ...]
  }

  getSuggestions(query) {
    const lower = query.toLowerCase();
    return this.items.filter((item) =>
      item.label.toLowerCase().includes(lower),
    );
  }

  renderSuggestion(item, el) {
    el.createEl("div", { text: item.label });
  }

  onChooseSuggestion(item, evt) {
    this.resolve(item.value ?? item.label);
  }

  openAndGetValue() {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
}

export async function promptSelection({ of: items = [] } = {}) {
  assert(isNonEmptyArray(items), "Cannot prompt for a selection of no items");
  const modal = new SelectionModal(app, items);
  const selection = await modal.openAndGetValue();
  return selection;
}

// TODO: Probably move the model
class InputModal extends Modal {
  constructor(app, { label, placeholder = "", defaultAnswer = "" }) {
    super(app);
    this.label = label;
    this.placeholder = placeholder;
    this.defaultAnswer = defaultAnswer;
  }
  
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: this.label });

    let value = this.defaultAnswer;

    const submit = () => {
      this.close();
      this.resolve(value);
    };
    
    new Setting(contentEl)
      .addText((text) => {
        text
          .setPlaceholder(this.placeholder)
          .setValue(this.defaultAnswer)
          .onChange((v) => {
            value = v;
          });
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        });
      })
      .addButton((btn) =>
        btn
          .setButtonText("OK")
          .setCta()
          .onClick(submit),
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  openAndGetValue() {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
}

export async function promptInput({ label, defaultAnswer, placeholder } = {}) {
  const modal = new InputModal(app, { label, defaultAnswer, placeholder });
  const result = await modal.openAndGetValue();
  return result;
}

export const getLatestFileContent = async function (tFile) {
  const activeLeaf = app.workspace.activeLeaf;

  if (activeLeaf && activeLeaf.view) {
    const activeFile = activeLeaf.view.file;

    if (activeFile && activeFile === tFile) {
      return activeLeaf.view.editor.getValue();
    }
  }

  return await app.vault.read(tFile);
};


const isMarkdownLeaf = function(leaf) {
  if (leaf?.view?.getViewType?.() !== "markdown") return false;
  return true;
}

const getBestMarkdownLeaf = function() {
  const leaf = app.workspace.activeLeaf;
  if (isMarkdownLeaf(leaf)) return leaf;

	const mostRecentLeaf = app.workspace.getMostRecentLeaf();
	if (isMarkdownLeaf(mostRecentLeaf)) return mostRecentLeaf;

	return undefined;
}

export const insertAtCursor = function(text) {
  const leaf = getBestMarkdownLeaf();
  if (!leaf) {
		new Notice("Cannot insert into non-markdown window");
	  return;
	}

  const view = leaf.view;
  const editor = view && view.editor;
  if (!editor) return;

  editor.focus();
  editor.replaceSelection(text);
}
