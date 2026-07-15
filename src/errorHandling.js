import { spawnUserNotice } from "./obsidianUtils";

export const runSafely = function(callback) {
  try {
    return callback();
  } catch (error) {
    spawnUserNotice({ message: error?.message || error });
    console.error(error);
  }
}
