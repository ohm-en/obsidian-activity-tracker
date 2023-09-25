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
  activity_group_matchings,
  date,
}) {
  const regex_iterator = timeline_text.matchAll(activity_regex);
  let activities = [];
  for (const match of regex_iterator) {
    const current_activity = {};

    match.forEach(function (group, index) {
      if (activity_group_matchings[index]) {
        current_activity[activity_group_matchings[index]] = group;
      }
    });

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

    workflowM = {
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

  // const count_of_parsed = activities.length;
  // if (timeline.count === undefined) {
  //   console.error(`${date}: Missing the currentId field.`);
  // } else if (count != count_of_parsed) {
  //   const listed_ids = activities.map(function (activity) {
  //     return activity.id;
  //   });
  //   // NOTE: FIXME
  //   let missing_ids = [];
  //   for (let i = 1; i < count_of_parsed; i++) {
  //     if (!listed_ids.includes(i)) {
  //       missing_ids.push(i);
  //     }
  //   }
  //   console.error(
  //     `${date}: Expected to find ${
  //       count
  //     } activities, but instead found ${count_of_parsed}. Missing IDs: ${
  //       missing_ids.join(", ") || "none"
  //     }.`
  //   );
  // }

  return activities;
};

const parseTimeline = function ({
  from: timeline_text,
  activity_regex,
  activity_group_matchings,
  date,
}) {
  // const timeline_text = extract_timeline_from_header(header, text);
  const activities = extract_activities({
    from: timeline_text,
    activity_regex,
    activity_group_matchings,
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

const dailyNotePathSchema = "[Logs]/YYYY/MM - MMMM (Y)/Y-MM-DD[.md]";

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

  const refresh = async function () {
    text = await app.vault.cachedRead(tFile);
  };

  await refresh();

  return Object.freeze({
    name: tFile.basename,
    text,
    yaml,
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
  const dailyNote = await getDailyNote({});
  const { activity_group_matchings, workflow_path } = dailyNote.yaml;

  const activity_regex = new RegExp(dailyNote.yaml.activity_regex, "g");
  if (!workflow_path || !activity_regex || !activity_group_matchings) {
    new Notice(
      "Please define workflow_path, activity_regex and activity_group_matchings in your daily note."
    );
    return;
  }

  const todaysTimeline = parseTimeline({
    from: dailyNote.text,
    activity_regex,
    activity_group_matchings,
    date: dailyNote.name, // TODO: date may not always be shared!
  });

  const workflows = await getWorkflows({
    from: workflow_path,
  });

  // TODO: add checks for #END
  if (!todaysTimeline.activities[0]) {
    const newActivity = await createNewActivity({ id: 1, workflows });
    await dailyNote.append({ text: "\n" + newActivity });
    return;
  }

  const lastActivityWasCompleted =
    todaysTimeline.activities[todaysTimeline.activities.length - 1].end_time !=
    "#END";

  const previousActivity = lastActivityWasCompleted
    ? todaysTimeline.activities[todaysTimeline.activities.length - 1]
    : todaysTimeline.activities[todaysTimeline.activities.length - 2] || {};

  if (lastActivityWasCompleted) {
    const newActivity = await createNewActivity({
      id: Number(previousActivity.id) + 1,
      workflows,
    });
    await dailyNote.append({ text: "\n" + newActivity });
  } else {
    const ongoingActivity =
      todaysTimeline.activities[todaysTimeline.activities.length - 1];
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
        begin.clone().subtract(31, "second").isBefore(previousActivityEndMoment)
      ) {
        new Notice("Since last Activity. You did it!");
        return previousActivityEndMoment.add(1, "seconds");
      } else {
        return begin;
      }
    })();

    const completedActivity = ongoingActivity.raw
      .replace(
        /#I *==00:00==-==00:00==/,
        `#${ident} ==${beginMoment.format("HH:mm")}==-==${endMoment.format(
          "HH:mm"
        )}==`
      )
      .replace(/:BEGAN: #BEG */, `:BEGAN: ${beginMoment.format("X")}`)
      .replace(/:ENDED: #END */, `:ENDED: ${endMoment.format("X")}`);

    const updatedDailyNote = dailyNote.text.replace(
      ongoingActivity.raw,
      completedActivity
    );

    await dailyNote.modify({ newContent: updatedDailyNote });
  }
};

main();
_%>
