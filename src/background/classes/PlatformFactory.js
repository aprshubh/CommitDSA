import { LeetCodePlatform } from './LeetCodePlatform.js';
import { GfgPlatform } from './GfgPlatform.js';

export class PlatformFactory {
  /**
   * Instantiates and returns the class representation for the given platform.
   * @param {string} platformId - The unique ID of the platform (e.g. 'leetcode', 'gfg').
   * @returns {CodingPlatform} An instance of the corresponding platform subclass.
   */
  static getPlatform(platformId) {
    switch (platformId.toLowerCase()) {
      case 'leetcode':
        return new LeetCodePlatform();
      case 'gfg':
        return new GfgPlatform();
      default:
        throw new Error(`Unsupported platform: ${platformId}`);
    }
  }
}
