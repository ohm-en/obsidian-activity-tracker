/**
 * @global
 * @type {typeof import('moment')}
 */

// TODO: require timeline helper as dependancy
import {
  completeOnGoingActivity,
  createNewActivity,
  getActivityMoments,
  getConfigurationFromDaily,
  getTimelineFromDaily,
  isIncompleteActivity,
  promptForIdentifer,
} from "./activityGenerator.js";
import {
  getDailyNote,
  getWorkflows,
  spawnUserNotice,
} from "./obsidianUtils.js";
import { assert } from "./utils.js";

const main = async function () {
  try {
    const dailyNote = await getDailyNote({});
    const config = await getConfigurationFromDaily({ dailyNote });
    const todaysTimeline = getTimelineFromDaily({
      dailyNote,
      activity_regex: config.activity_regex,
    });

    const { activities } = todaysTimeline;

    const workflows = await getWorkflows({
      from: config.workflow_path,
    });

    const incompletedActivities = activities.filter((activity) =>
      isIncompleteActivity({
        activity,
        stopPlaceholderTag: config.timeStopTag,
      }),
    );

    if (incompletedActivities.length > 0) {
      assert(
        incompletedActivities.length <= 1,
        "Failure! More than one activity is marked as incomplete!",
      );
      // const ongoingActivity = activities[activities.length - 1];
      const previousActivity = activities[activities.length - 2] || {};

      const [beginMoment, endMoment] = await getActivityMoments({
        basedOn: moment.unix(previousActivity.end_time),
      });

      const identifier = await promptForIdentifer();

      await completeOnGoingActivity({
        dailyNote,
        identifier,
        beginMoment,
        endMoment,
        config,
      });
    } else if (Array.isArray(activities)) {
      const previousActivity = activities.at(-1);
      const newActivity = await createNewActivity({
        id: (Number(previousActivity?.id) || 0) + 1,
        workflows,
        timeStartTag: config.timeStartTag,
        timeStopTag: config.timeStopTag,
      });
      await dailyNote.append({ text: "\n" + newActivity });
    } else {
      new Error("Activities did not parse correctly!");
    }
  } catch (error) {
    spawnUserNotice({ message: error?.message || error });
    console.error(error);
  }
};

main();
