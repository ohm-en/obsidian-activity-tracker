import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { main } from "./main";
import { insertAtCursor } from './obsidianUtils';
import { runSafely } from './errorHandling';

const DEFAULT_SETTINGS = {
  dailyNotePathSchema: '[daily]/YYYY/MM/YYYY-MM-dd[.md]'
};

class ActivityTrackerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Activity Tracker Settings' });

    // TODO: Dynamically update a reference to the current location so the syntax is clear to the user
    new Setting(containerEl)
      .setName('Daily note path schema')
      .setDesc(`Moment.js template for where daily notes are stored (e.g., ${DEFAULT_SETTINGS.dailyNotePathSchema}).`)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dailyNotePathSchema)
          .setValue(this.plugin.settings.dailyNotePathSchema || '')
          .onChange(async (value) => {
            this.plugin.settings.dailyNotePathSchema = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

// TODO: Replace class/this with functions
class ActivityTrackerPlugin extends Plugin {
  settings = {};
  
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new ActivityTrackerSettingTab(this.app, this));
    
    this.addCommand({
      id: 'track-interval',
      name: 'Track Interval',
      callback: () => this.trackInterval()
    });

    this.addCommand({
      id: 'track-duration',
      name: 'Track Duration',
      callback: () => this.trackDuration()
    });

    this.addCommand({
      id: 'insert-timestamp',
      name: 'Insert Timestamp',
      callback: () => this.insertTimestamp()
    })
  }

  insertTimestamp() {
    // TODO: make timestamp configurable (apply to template code as well)
    runSafely(() => {
      const timestamp = moment().format("==HH:mm==");
      insertAtCursor(timestamp + " ");
    });
  }

  trackInterval() {
    main({
      dailyNotePathSchema: this.settings.dailyNotePathSchema,
      useIntervalTracking: true
    });
  }

  trackDuration() {
    main({
      dailyNotePathSchema: this.settings.dailyNotePathSchema
    });
  }

  // --- Settings persistence ---
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

module.exports = ActivityTrackerPlugin;
