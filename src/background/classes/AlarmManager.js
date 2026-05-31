export class AlarmManager {
  /**
   * Dynamically registers or clears chrome alarms based on the enabled status of platforms.
   * Ensures that disabled platforms never fire background fetch tasks.
   * 
   * @param {Array<string>} enabledPlatforms - List of enabled platform IDs (e.g. ['leetcode', 'gfg']).
   */
  static async updateAlarms(enabledPlatforms) {
    const ALL_SUPPORTED_PLATFORMS = ['leetcode', 'gfg'];

    for (const platformId of ALL_SUPPORTED_PLATFORMS) {
      // Map platformId to the alarm name
      // 'leetcode' -> 'fetchDailyChallenge' (matches existing code standard for backward compatibility)
      // 'gfg' -> 'fetchGfgDailyChallenge'
      let alarmName = '';
      if (platformId === 'leetcode') {
        alarmName = 'fetchDailyChallenge';
      } else if (platformId === 'gfg') {
        alarmName = 'fetchGfgDailyChallenge';
      } else {
        alarmName = `fetch_${platformId}_DailyChallenge`;
      }

      if (enabledPlatforms.includes(platformId)) {
        // Check if alarm already exists before creating to prevent resetting timers unnecessarily
        const existingAlarm = await chrome.alarms.get(alarmName);
        if (!existingAlarm) {
          chrome.alarms.create(alarmName, { periodInMinutes: 1440 });
          console.log(`[CommitDSA] Alarm registered/started for platform: ${platformId} (Alarm: ${alarmName})`);
        }
      } else {
        // Clear the alarm for disabled platform
        const cleared = await chrome.alarms.clear(alarmName);
        if (cleared) {
          console.log(`[CommitDSA] Alarm cleared/disabled for platform: ${platformId} (Alarm: ${alarmName})`);
        }
      }
    }
  }
}
