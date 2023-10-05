import { parseTimeline } from "../../obsidian-daily-log-helper/src/text_processing.js";

const dailyNotePathSchema = "[Logs]/YYYY/MM - MMMM (Y)/Y-MM-DD[.md]";

function splitOnFrontMatter({ from: text }) {
  const regex = /(?<yaml>^---\s*[\s\S]*?---[ 	]*)/;
  const match = text.match(regex);
  if (match) {
    const yaml = match[1];
    const restOfContent = text.replace(regex, "");
    return [yaml, restOfContent];
  }

  return ["", text];
}

const getTFile = function ({ from: filePath }) {
  const tFile = app.vault.getAbstractFileByPath(filePath);
  return tFile;
};

const isCursor = function (n) {
  if (app.isMobile === false) {
    return `\<%tp.file.cursor(${n})%\>`;
  }
  return "";
};

const getDailyNote = async function ({ from_date = moment() }) {
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

const getWorkflows = async function ({ from: path }) {
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

const promptSelection = async function ({ of: items }) {
  // TODO: assert items = { label, value }
  const selection = await tp.system.suggester(
    items.label,
    items.value || items.label,
    true
  );
  return selection;
};

const promptInput = async function ({ label, defaultAnswer }) {
  const input = await tp.system.prompt(label, defaultAnswer, true);
  return input;
};

const createNewActivity = async function ({ id, workflows }) {
  const test = workflows.map((workflow) => workflow.name);
  const workflow = await promptSelection({
    of: { label: test, value: workflows },
  });

  const formatted_attributes =
    workflow.attributes.length > 0
      ? workflow.attributes
          .map(function (attribute, i) {
            const parsed = `(${attribute} ${isCursor(i + 1)})`;
            return parsed;
          })
          .join(" ") + " "
      : "";

  const timeStamp = moment().format("==HH:mm==");

  const activity = `- #I ==00:00==-==00:00== (⏳ [[${
    workflow.name
  }]]) ${formatted_attributes}^id-${id}\n	- :PROPERTIES:\n		- :BEGAN: #BEG\n		- :ENDED: #END\n	- ${timeStamp} ${isCursor(
    0
  )}`;
  return activity;
};

const main = async function () {
  try {
    const dailyNote = await getDailyNote({});
    const {
      workflow_path,
      time_start_placeholder_tag,
      time_stop_placeholder_tag,
    } = dailyNote.yaml;

    // TODO: assert require configruation fields

    const activity_regex = new RegExp(dailyNote.yaml.activity_regex, "g");
    if (!workflow_path || !activity_regex) {
      new Notice(
        "Please define workflow_path, activity_regex and activity_group_matchings in your daily note."
      );
      return;
    }

    const todaysTimeline = parseTimeline({
      from: dailyNote.text,
      activity_regex,
      date: dailyNote.name, // TODO: date may not always be shared!
    });

    const { activities } = todaysTimeline;

    const workflows = await getWorkflows({
      from: workflow_path,
    });

    if (!activities[0]) {
      const newActivity = await createNewActivity({ id: 1, workflows });
      await dailyNote.append({ text: "\n" + newActivity });
      return;
    }

    const startPlaceholderTag = "#" + time_start_placeholder_tag.trim();
    const stopPlaceholderTag = "#" + time_stop_placeholder_tag.trim();

    const incompletedActivities = activities.reduce(function (
      incompleted,
      activity
    ) {
      if (!activity.end_time || activity.end_time === stopPlaceholderTag) {
        return [...incompleted, activity];
      }
      return incompleted;
    },
    []);

    if (incompletedActivities.length > 1) {
      throw new Error(
        "Failure! More than one activity is marked as incomplete!"
      );
    }

    const isAnyIncompleteActivities = incompletedActivities.length > 0;
    if (isAnyIncompleteActivities) {
      const ongoingActivity = activities[activities.length - 1];
      const previousActivity = activities[activities.length - 2] || {};
      const oneHourAgo = moment().subtract(1, "hours");
      const hours = oneHourAgo.isBefore(moment.unix(previousActivity.end_time))
        ? "0"
        : await promptInput({ label: "Hours: " });

      const minutes = await promptInput({
        label: "Minutes: ",
      });

      const identifiers = [
        "👍", // A Normal Activity
        "〽️", // Unusual Activity
        "⭐", // Meaningful Activity
        "🤬", // Seething Rage
      ];

      const ident = await promptSelection({
        of: { label: identifiers, value: identifiers },
      });
      const endMoment = moment();
      const beginMoment = (function () {
        // NOTE: This weird syntax creates a clone of the "moment";
        const begin = moment(endMoment)
          .subtract(hours, "hours")
          .subtract(minutes, "minutes");
        previousActivityEndMoment = moment.unix(previousActivity.end_time);
        if (
          begin
            .clone()
            .subtract(31, "second")
            .isBefore(previousActivityEndMoment)
        ) {
          new Notice("Since last Activity. You did it!");
          return previousActivityEndMoment.add(1, "seconds");
        } else {
          return begin;
        }
      })();

      await dailyNote.process(function (data) {
        const [yaml, text] = splitOnFrontMatter({ from: data });
        const newText = text
          .replace(
            /#I *==00:00==-==00:00==/,
            `#${ident} ==${beginMoment.format("HH:mm")}==-==${endMoment.format(
              "HH:mm"
            )}==`
          )
          .replace(startPlaceholderTag, beginMoment.format("X"))
          .replace(stopPlaceholderTag, endMoment.format("X"));
        const newData = yaml + newText;
        return newData;
      });
    } else {
      const previousActivity = activities[activities.length - 1];
      const newActivity = await createNewActivity({
        id: Number(previousActivity.id) + 1,
        workflows,
      });
      await dailyNote.append({ text: "\n" + newActivity });
    }
  } catch (error) {
    new Notice(error);
  }
};

main();
