import { assert, isNonEmptyString, isObject, pipe } from "./utils.js";

const makeGlobalRegexExpression = function (string) {
  return new RegExp(string, "g");
};

const escapeRegexSymbols = function (string) {
  const updatedString = string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  return updatedString;
};

const replaceWhitespaceWithRegexPermissiveWhitespace = function (string) {
  const updatedString = string.replace(/\s+/g, "\\s*");
  return updatedString;
};

const replaceTemplateVariableWithValue = function (
  template,
  templateVariableKey,
  templateVariableValue,
  useEscapedBraces = false,
) {
  assert(typeof template === "string", "template must be a string");
  assert(
    isNonEmptyString(templateVariableKey),
    "templateVariableKey must be a non-empty string",
  );
  assert(
    isNonEmptyString(templateVariableValue),
    "templateVariableValue must be a non-empty string",
  );

  // TODO:: Key should be limited to [A-Za-z0-9_] and therefore should not require escaping.
  // Escape the key itself to avoid regex metachar issues
  const escapedKey = templateVariableKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const patternSrc = useEscapedBraces
    ? String.raw`\\\{\\\{\s*` + escapedKey + String.raw`\s*\\\}\\\}`
    : String.raw`\{\{\s*` + escapedKey + String.raw`\s*\}\}`;

  const varPattern = new RegExp(patternSrc, "g");

  return template.replace(varPattern, templateVariableValue);
};

export const replaceVariablesInTemplate = function (
  template,
  templateVariables,
  useEscapedBraces = false,
) {
  assert(typeof template == "string", "template must a be string");
  assert(
    isObject(templateVariables),
    `templateVariables must be a valid object not ${typeof templateVariables}`,
  );

  const templateVariableEntries = Object.entries(templateVariables);
  const updatedTemplate = templateVariableEntries.reduce(function (
    currentTemplate,
    [templateVariableKey, templateVariableValue],
  ) {
    return replaceTemplateVariableWithValue(
      currentTemplate,
      templateVariableKey,
      templateVariableValue,
      useEscapedBraces,
    );
  }, template);

  return updatedTemplate;
};

const makeRegexMatchGroupString = function (
  matchGroupName,
  matchGroupRegexString,
) {
  const matchGroupString = `(?<${matchGroupName}>${matchGroupRegexString})`;
  return matchGroupString;
};

const objectEntryToMatchGroup = function ([key, value]) {
  return [key, makeRegexMatchGroupString(key, value)];
};

// TODO: Make some of these configurable templates
// TODO: The group names here are legacy for my needs. Set more sane defaults for other users. (Or make it configurable.)
const templateRegexMap = {
  emoji: String.raw`\S+`,
  time: String.raw`==\d\d:\d\d==-==\d\d:\d\d==`,
  workflow_metadata: String.raw`\(.{0,2}\s+.*\)+`, // legacy
  id: String.raw`\d{1,}`,

  begin_time: String.raw`\d{10}|#BEG`,
  end_time: String.raw`\d{10}|#END`,

  notes: String.raw`.*`,
  // TODO: Re-implement extra notes
  // extra_notes: String.raw`(?:\n[ \t]{2,}- .*?)*`,
};

// PERF: For ease, this is computed as import time.
const templateVariableRegexMap = Object.fromEntries(
  Object.entries(templateRegexMap).map(objectEntryToMatchGroup),
);

export const activityTemplateToRegex = function (activityTemplate) {
  assert(
    activityTemplate,
    "Please define activity_template or acrivity_regex (legacy) in your daily note.",
  );

  const pipeline = pipe(
    escapeRegexSymbols,
    (str) => replaceVariablesInTemplate(str, templateVariableRegexMap, true),
    replaceWhitespaceWithRegexPermissiveWhitespace,
    makeGlobalRegexExpression,
  );
  const activityRegex = pipeline(activityTemplate);
  return activityRegex;
};
