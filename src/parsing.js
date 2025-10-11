import { assert } from "./utils";

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

// TODO: Fully integrate parser with the rest of the codebase. This was pulled in and stripped from a older codebase. It needs great improvement.

const checkForActivityWarnings = function (date, activities) {
  try {
    const listed_ids = activities.map((activity) => parseInt(activity.id));
    const expected_ids = Array.from(
      { length: activities.length },
      (_, i) => i + 1,
    );

    const missing_ids = expected_ids.filter((id) => !listed_ids.includes(id));

    if (missing_ids.length > 0) {
      console.warn(
        `${date}: Expected to find ${
          expected_ids.length
        } activities, but instead found ${
          expected_ids.length - missing_ids.length
        }. Missing IDs: ${missing_ids.join(", ") || "none"}.`,
      );
    }

    activities.forEach(function (activity, index, array) {
      if (activity?.duration && activity.duration < 0) {
        console.warn(
          `${date}^${activity.id}: activity's duration was negative!`,
        );
        return; // NOTE: Can't reliably warn on anything else if this is true
      }

      const lastActivity = array[index - 1];
      if (lastActivity) {
        const time_between_activities =
          activity.begin_time - lastActivity.end_time;
        if (time_between_activities < 0) {
          console.warn(
            `${date}^${activity.id}: activity begin before the last activity ended!`,
          );
        }
      }
    });
  } catch (error) {
    console.error(
      `${date}: an unknown failure occured while checking for activity warnings!`,
      error,
    );
  }
};

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
      "You must define group mapping for field `id`!",
    );

    activities.forEach(function (activity) {
      if (activity.id === current_activity.id) {
        console.error(`${date}: Has duplidate id, ${current_activity.id}.`);
      }
    });

    const variable_fields = parse_attribute_variables(
      current_activity.workflow_metadata,
    );

    const workflow = variable_fields["⏳"];
    assert(
      Array.isArray(workflow) && workflow.length > 0,
      `There's a missing workflow at ${date}^id-${current_activity.id}`,
    );

    const duration = current_activity.end_time
      ? current_activity.end_time - current_activity.begin_time
      : undefined;

    const additional_activity_metadata = {
      date,
      workflow,
      duration,
    };

    activities.push({ ...current_activity, ...additional_activity_metadata });
  }

  checkForActivityWarnings(date, activities);
  return activities;
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

const parse_attribute_variables = function (text) {
  const regex = /\((⏳)\s+([^⏳]*)\)/g;
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

export const parseTimeline = function ({
  from: timeline_text,
  activity_regex,
  date,
}) {
  const activities = extract_activities({
    from: timeline_text,
    activity_regex,
    date,
  });

  return Object.freeze({
    activities,
  });
};
