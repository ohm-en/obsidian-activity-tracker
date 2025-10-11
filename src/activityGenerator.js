import { isCursor, promptInput, promptSelection } from "./obsidianUtils";
import { parseTimeline } from "../../obsidian-daily-log-helper/src/text_processing.js";
import { splitOnFrontMatter } from "./parsing.js";
import { assert, isMomentWithinAnHour, isNonEmptyString } from "./utils.js";
import {
  activityTemplateToRegex,
  replaceVariablesInTemplate,
} from "./activityTemplateTransformer.js";
import { replaceLiteralNewlines } from "./stringUtils.js";

// TODO: Make a more appropiate name.
export const undefined_emoji = String.raw`#Ie`;
export const undefined_time = String.raw`==00:00==-==00:00==`;

export const createNewActivity = async function ({
  id,
  timeStart,
  timeStop,
  workflows,
  activityTemplate,
}) {
  assert(
    typeof activityTemplate == "string",
    "activityTemplate must be defined",
  );

  const workflowOptions = workflows.map(function (workflow) {
    return { value: workflow, label: workflow.name };
  });

  const workflow = await promptSelection({
    of: workflowOptions,
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

  const templateVariableValueMap = {
    emoji: undefined_emoji,
    time: undefined_time,
    workflow_metadata: String.raw`(⏳ [[${workflow.name}]]) ${formatted_attributes}`,
    id: String.raw`${id}`,
    begin_time: String.raw`${timeStart}`,
    end_time: String.raw`${timeStop}`,
    notes: String.raw`${timeStamp} ${isCursor(0)}`,
    // TODO: Re-implement extra notes
    // extra_notes: String.raw`(?:\n[ \t]{2,}- .*?)*`,
  };

  const activity = replaceVariablesInTemplate(
    activityTemplate,
    templateVariableValueMap,
  );

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
      .replace(undefined_emoji, identifier)
      .replace(
        undefined_time,
        `==${beginMoment.format("HH:mm")}==-==${endMoment.format("HH:mm")}==`,
      )
      .replace(config.timeStartPlaceholderTag, beginMoment.format("X"))
      .replace(config.timeStopPlaceholderTag, endMoment.format("X"));

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

  const identifierOptions = identifiers.map(function (identifier) {
    return { value: identifier, label: identifier };
  });

  const identifier = await promptSelection({
    of: identifierOptions,
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
    activity_regex: legacy_activity_regex,
    activity_template: activity_template_with_literal_newlines,
    time_start_placeholder_tag,
    time_stop_placeholder_tag,
  } = dailyNote.yaml;

  // Obsidian properties cannot contain actual newlines, so the user must specify \n instead. They must be converted.
  const activity_template = replaceLiteralNewlines(
    activity_template_with_literal_newlines,
  );

  // TODO: Either remove legacy_activity_regex, or allow purposefully injection to replace the template.
  const activity_regex = legacy_activity_regex
    ? new RegExp(legacy_activity_regex, "g")
    : activityTemplateToRegex(activity_template);

  assert(
    activity_regex,
    "Please define activity_template or acrivity_regex (legacy) in your daily note.",
  );

  // TODO: Move these variables elsewhere. They aren't required for long term parsing. Only creation.
  assert(
    isNonEmptyString(workflow_path),
    "Please define workflow_path as a text property in your daily note.",
  );
  assert(
    time_start_placeholder_tag,
    "Please define time_start_placeholder_tag in your daily note.",
  );
  assert(
    time_stop_placeholder_tag,
    "Please define time_stop_placeholder_tag in your daily note.",
  );

  const timeStartPlaceholderTag = "#" + time_start_placeholder_tag.trim();
  const timeStopPlaceholderTag = "#" + time_stop_placeholder_tag.trim();

  const config = {
    workflow_path,
    timeStartPlaceholderTag,
    timeStopPlaceholderTag,
    activity_regex,
    activity_template, // not required because this fn may be later used for parsing foccued code
  };

  return config;
};
