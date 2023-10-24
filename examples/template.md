<%-*
'use strict';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

const extract_activities = function ({
  from: timeline_text,
  activity_regex,
  date,
}) {
  const regex_iterator = timeline_text.matchAll(activity_regex);
  let activities = [];
  for (const match of regex_iterator) {
    const current_activity = match.groups || {};

    assert(
      current_activity.id,
      "You must define group mapping for field `id`!"
    );

    activities.forEach(function (activity) {
      if (activity.id === current_activity.id) {
        console.error(`${date}: Has duplidate id, ${current_activity.id}.`);
      }
    });

    const variable_fields = parse_variables(current_activity.workflow_metadata);

    const workflow = variable_fields["⏳"];
    assert(
      Array.isArray(workflow) && workflow.length > 0,
      `There's a missing workflow at ${date}^id-${current_activity.id}`
    );
    const noun = variable_fields["👗"];
    // const people = variable_fields["👥"];
    // const commute = variable_fields["✈"];
    const is = variable_fields["📚"];

    const workspace = variable_fields["🧮"]
      ? variable_fields["🧮"][0]
      : undefined;

    const ws_id = workspace ? workspace.value : undefined;
    const wf = workflow ? workflow[0].value : undefined;

    const is_is = is ? (is[0] ? is[0].value : undefined) : undefined;

    const duration = current_activity.end_time
      ? current_activity.end_time - current_activity.begin_time
      : undefined;

    const workflowM = {
      date,
      workspace,
      workflow,
      ws_id,
      wf,
      is_is,
      noun,
      is,
      duration,
    };

    activities.push({ ...current_activity, ...workflowM });
  }

  const listed_ids = activities.map((activity) => parseInt(activity.id));
  const expected_ids = Array.from(
    { length: activities.length },
    (_, i) => i + 1
  );

  const missing_ids = expected_ids.filter((id) => !listed_ids.includes(id));

  if (missing_ids.length > 0) {
    console.error(
      `${date}: Expected to find ${
        expected_ids.length
      } activities, but instead found ${
        expected_ids.length - missing_ids.length
      }. Missing IDs: ${missing_ids.join(", ") || "none"}.`
    );
  }

  return activities;
};

const parseTimeline = function ({ from: timeline_text, activity_regex, date }) {
  // const timeline_text = extract_timeline_from_header(header, text);
  const activities = extract_activities({
    from: timeline_text,
    activity_regex,
    date,
  });

  return Object.freeze({
    //text: timeline_text,
    activities,
  });
};

const parse_values = function (text) {
  const regex =
    /^(?:\"([^\"\']+)\"|#([^#\n ]+)|\[\[([^\]\[\|#]+)(?:#([^\]\[\|#]*))?(?:\|([^\]\[\|#]*))?\]\]|\[([^\[\]]+)?\]\(([A-Za-z]+):\/\/([^\)\(]+)\))/;

  const reduce = function (accumulator, string) {
    const match = string.match(regex);
    if (match) {
      if (match[1]) {
        accumulator.push({
          type: "string",
          value: match[1],
        });
      } else if (match[2]) {
        accumulator.push({
          type: "tag",
          value: match[2],
        });
      } else if (match[3]) {
        accumulator.push({
          type: "wikilink",
          value: match[3],
          heading: match[4] || undefined,
          alias: match[5] || undefined,
        });
      } else if (match[8]) {
        accumulator.push({
          type: "link",
          value: match[8],
          protocol: match[7] || undefined,
          alias: match[6] || undefined,
        });
      }

      // TODO: FIXME
      const str = match[0];
      //const escapedStr = RegExp.escape(str);
      //const replace_regex = new RegExp(`(?:\s*)?${escapedStr}(?:\s*)?`);
      const new_string = string.replace(str, "");
      // NOTE: Drill down until match not long;
      return reduce(accumulator, new_string.trim());
    } else {
      return accumulator;
    }
  };

  const variables = reduce([], text.trim());

  return variables;
};

const parse_variables = function (text) {
  const regex = /\((⏳|🧮|👗|👥|✈|📚)\s+([^⏳🧮👗👥✈📚]*)\)/g;
  const match_iterator = text.matchAll(regex);
  const variables = {};
  for (const match of match_iterator) {
    const key = match[1];
    const textual_values = match[2];
    const values = parse_values(textual_values);
    variables[key] = values;
  }

  return variables;
};

// TODO: require timeline helper as dependancy

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
      const previousActivityEndMoment = moment.unix(previousActivity.end_time);
      const oneHourAgo = moment().subtract(1, "hours");
      const hours = oneHourAgo.isBefore(previousActivityEndMoment)
        ? "0"
        : await promptInput({ label: "Hours: " });

      const isHoursWithinLastActivity = moment()
        .subtract(Number(hours), "hours")
        .isBefore(previousActivityEndMoment);

      const minutes = isHoursWithinLastActivity
        ? undefined
        : await promptInput({
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
        if (isHoursWithinLastActivity) {
          new Notice("Last activity ended within inputted hours");
          return previousActivityEndMoment.add(1, "seconds");
        }
        const begin = moment(endMoment)
          .subtract(hours, "hours")
          .subtract(minutes, "minutes")
          .subtract(31, "second");

        const isHoursAndMinutesWithinLastActivity = begin.isBefore(
          previousActivityEndMoment
        );

        if (isHoursAndMinutesWithinLastActivity) {
          new Notice("Last activity ended within inputted duration");
          return previousActivityEndMoment.add(1, "seconds");
        }
        return begin;
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
_%>
