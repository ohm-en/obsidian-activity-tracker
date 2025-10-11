// TODO: Create proper utils folder

export const assert = function (condition, message = "Assertion failed") {
  if (!condition) {
    if (message instanceof Error) {
      throw message;
    } else {
      throw new Error(message);
    }
  }
};

export const isMomentWithinAnHour = function (initialMoment) {
  const oneHourAgoMoment = moment().subtract(1, "hours");
  const withinAnHour = oneHourAgoMoment.isBefore(initialMoment) ? true : false;
  return withinAnHour;
};

export const pipe = function (...fns) {
  return (input) => fns.reduce((acc, fn) => fn(acc), input);
};

export const isNonEmptyString = function (string) {
  return typeof string === "string" && string != "";
};

export const isNonEmptyArray = function (arrayCandidate) {
  return Array.isArray(arrayCandidate) && arrayCandidate.length > 0;
};

export const isObject = function (objCandidate) {
  if (typeof objCandidate != "object") return false;
  if (objCandidate == null) return false;
  return true;
};
