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

const main = async function () {
  try {
    const dailyNote = await getDailyNote({});
    const config = getConfigurationFromDaily({ dailyNote });
    const todaysTimeline = getTimelineFromDaily({ dailyNote });

    const { activities } = todaysTimeline;

    const workflows = await getWorkflows({
      from: workflow_path,
    });

    const incompletedActivities = activities.filter(isIncompleteActivity);

    if (incompletedActivities.length > 0) {
      assert(
        incompletedActivities.length > 1,
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
      });
      await dailyNote.append({ text: "\n" + newActivity });
    } else {
      new Error("Activities did not parse correctly!");
    }
  } catch (error) {
    spawnUserNotice(error?.message || error);
  }
};

main();
