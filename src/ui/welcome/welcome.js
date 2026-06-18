'use strict';

/**
 * @fileoverview Logic for the Welcome Page (Setup Guide).
 * Syncs the theme selection with chrome.storage.local.
 */

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  
  // Apply initial theme from storage or default to light
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['theme'], ({ theme }) => {
      const activeTheme = theme || 'light';
      applyTheme(activeTheme);
    });
  } else {
    // Fallback if running outside extension context
    applyTheme('light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const nextTheme = isDark ? 'light' : 'dark';
      
      applyTheme(nextTheme);
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: nextTheme });
      }
    });
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      if (themeToggle) themeToggle.classList.add('dark-active');
    } else {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      if (themeToggle) themeToggle.classList.remove('dark-active');
    }
  }
});
