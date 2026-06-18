// @ts-check

/**
 * @fileoverview Service worker entry point for CommitDSA.
 * Bootstraps the central application orchestrator synchronously.
 */

import { initializeApp, registerListeners } from './App.js';

// Synchronously register all Chrome API event listeners
registerListeners();

// Asynchronously initialize storage data, migrations, and alarms
initializeApp().catch((err) => {
  console.error('[CommitDSA][Bootstrap] Failed to initialize extension application:', err);
});
