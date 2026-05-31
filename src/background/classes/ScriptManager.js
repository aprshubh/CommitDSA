export class ScriptManager {
  /**
   * Dynamically registers or unregisters content scripts for each platform
   * depending on whether the platform is enabled in the settings.
   * Ensures that no content scripts execute on disabled domains.
   * 
   * @param {Array<string>} enabledPlatforms - List of enabled platform IDs (e.g. ['leetcode', 'gfg']).
   */
  static async updateContentScripts(enabledPlatforms) {
    // Config mappings containing matches for each supported platform
    const PLATFORM_CONFIGS = {
      leetcode: {
        matches: [
          "https://leetcode.com/problems/*",
          "https://*.leetcode.com/problems/*"
        ]
      },
      gfg: {
        matches: [
          "https://*.geeksforgeeks.org/problems/*"
        ]
      }
    };

    try {
      // 1. Get currently registered scripts
      const registeredScripts = await chrome.scripting.getRegisteredContentScripts();
      const registeredIds = registeredScripts.map(s => s.id);

      for (const platformId of Object.keys(PLATFORM_CONFIGS)) {
        const scriptId = `script_${platformId}`;

        if (enabledPlatforms.includes(platformId)) {
          // If enabled and not registered, register it
          if (!registeredIds.includes(scriptId)) {
            await chrome.scripting.registerContentScripts([{
              id: scriptId,
              js: ["content.js"],
              css: ["content.css"],
              matches: PLATFORM_CONFIGS[platformId].matches,
              runAt: "document_idle"
            }]);
            console.log(`[CommitDSA] Dynamic content script registered/activated for platform: ${platformId}`);
          }
        } else {
          // If disabled and registered, unregister it
          if (registeredIds.includes(scriptId)) {
            await chrome.scripting.unregisterContentScripts({ ids: [scriptId] });
            console.log(`[CommitDSA] Dynamic content script unregistered/deactivated for platform: ${platformId}`);
          }
        }
      }
    } catch (error) {
      console.error("[CommitDSA] Error in ScriptManager.updateContentScripts:", error);
    }
  }
}
