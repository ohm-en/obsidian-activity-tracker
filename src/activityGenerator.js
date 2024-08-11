import { isCursor, promptInput, promptSelection } from "./obsidianUtils";
import { parseTimeline } from "../../obsidian-daily-log-helper/src/text_processing.js";
import { splitOnFrontMatter } from "./parsing.js";
import { assert, isMomentWithinAnHour } from "./utils.js";

export const createNewActivity = async function ({
  id,
  timeStartTag,
  timeStopTag,
  workflows,
}) {
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
  }]]) ${formatted_attributes}^id-${id}\n	- :PROPERTIES: %% fold %%\n		- :BEGAN: ${timeStartTag}\n		- :ENDED: ${timeStopTag}\n	- ${timeStamp} ${isCursor(
    0,
  )}`;
  return activity;
};

export const isIncompleteActivity = function ({
  activity,
  stopPlaceholderTag,
}) {
  if (!activity.end_time || activity.end_time === stopPlaceholderTag) {
    return true;
  }
  return false;
};

export const getActivityMoments = async function ({
  basedOn: previousActivityEndMoment,
}) {
  const previousActivityWithinAnHour = isMomentWithinAnHour(
    previousActivityEndMoment,
  );

  const hours = previousActivityWithinAnHour
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
      previousActivityEndMoment,
    );

    if (isHoursAndMinutesWithinLastActivity) {
      new Notice("Last activity ended within inputted duration");
      return previousActivityEndMoment.add(1, "seconds");
    }
    return begin;
  })();

  return [beginMoment, endMoment];
};

export const completeOnGoingActivity = async function ({
  dailyNote,
  identifier,
  beginMoment,
  endMoment,
  config,
}) {
  await dailyNote.process(function (data) {
    const [yaml, text] = splitOnFrontMatter({ from: data });
    const newText = text
      .replace(
        /#I *==00:00==-==00:00==/,
        `#${identifier} ==${beginMoment.format("HH:mm")}==-==${endMoment.format(
          "HH:mm",
        )}==`,
      )
      .replace(config.timeStartTag, beginMoment.format("X"))
      .replace(config.timeStopTag, endMoment.format("X"));
    const newData = yaml + newText;
    return newData;
  });
};

export const promptForIdentifer = async function () {
  // TODO: Move to vault level configuration
  const identifiers = [
    "👍", // A Normal Activity
    "〽️", // Unusual Activity
    "⭐", // Meaningful Activity
    "🤬", // Seething Rage
  ];

  const identifier = await promptSelection({
    of: { label: identifiers, value: identifiers },
  });

  return identifier;
};

export const getTimelineFromDaily = function ({ dailyNote, activity_regex }) {
  const timeline = parseTimeline({
    from: dailyNote.text,
    activity_regex,
    date: dailyNote.name, // TODO: date may not always be shared!
  });
  return timeline;
};

export const getConfigurationFromDaily = async function ({ dailyNote }) {
  const {
    workflow_path,
    time_start_placeholder_tag,
    time_stop_placeholder_tag,
  } = dailyNote.yaml;
  const activity_regex = new RegExp(dailyNote.yaml.activity_regex, "g");

  assert(activity_regex, "Please define activity_regex in your daily note.");
  assert(workflow_path, "Please define workflow_path in your daily note.");
  assert(
    time_start_placeholder_tag,
    "Please define time_start_placeholder_tag in your daily note.",
  );
  assert(
    time_stop_placeholder_tag,
    "Please define time_stop_placeholder_tag in your daily note.",
  );

  const timeStartTag = "#" + time_start_placeholder_tag.trim();
  const timeStopTag = "#" + time_stop_placeholder_tag.trim();

  return {
    workflow_path,
    timeStartTag,
    timeStopTag,
    activity_regex,
  };
};
