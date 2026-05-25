// LeetCode Daily Challenge Tracker - Content Script

// 1. Inject inject.js to run in the main execution world
const injectScript = () => {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('inject.js');
  s.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(s);
};
injectScript();

// 2. Load Google Fonts dynamically for premium typography
const injectFonts = () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
};
injectFonts();

// Confetti Particle System Engine
class ConfettiEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4'];
    this.animationFrameId = null;
    this.resize();
    this.resizeListener = () => this.resize();
    window.addEventListener('resize', this.resizeListener);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  spawn() {
    const count = 140;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    for (let i = 0; i < count; i++) {
      // Direct particles outward from checkmark area
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 6;
      
      this.particles.push({
        x: centerX,
        y: centerY - 50,
        size: Math.random() * 8 + 4,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        angle: angle,
        speed: speed,
        gravity: 0.25,
        drag: 0.96,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 12 - 6,
        opacity: 1
      });
    }
  }

  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.speed *= p.drag;
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed + p.gravity;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.009;

      if (p.opacity <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.opacity;

      // Render mix of rectangles and circles
      if (i % 2 === 0) {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }
  }

  animate() {
    this.update();
    if (this.particles.length > 0) {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.resizeListener);
  }
}

// Build and show completion success overlay
const showCompletionOverlay = (dailyData, streak) => {
  // Prevent duplicate overlays
  if (document.getElementById('lc-tracker-success-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'lc-tracker-success-overlay';
  overlay.className = 'lc-tracker-overlay';

  const canvas = document.createElement('canvas');
  canvas.className = 'lc-tracker-canvas';
  overlay.appendChild(canvas);

  const difficultyClass = (dailyData.difficulty || 'Easy').toLowerCase();
  
  overlay.innerHTML += `
    <div class="lc-tracker-card">
      <div class="lc-tracker-checkmark-container">
        <div class="lc-tracker-checkmark-bg"></div>
        <svg class="checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
          <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
      </div>
      <div class="lc-tracker-badge">Daily Challenge</div>
      <h1 class="lc-tracker-title">Accepted!</h1>
      <p class="lc-tracker-problem">
        <span>${dailyData.title}</span>
        <span class="lc-tracker-difficulty ${difficultyClass}">${dailyData.difficulty}</span>
      </p>
      <div class="lc-tracker-divider"></div>
      <div class="lc-tracker-streak-card">
        <div class="lc-tracker-streak-fire">🔥</div>
        <div class="lc-tracker-streak-text">
          <div class="lc-tracker-streak-val">${streak} Day${streak > 1 ? 's' : ''} Streak</div>
          <div class="lc-tracker-streak-lbl">Keep it burning!</div>
        </div>
      </div>
      <button class="lc-tracker-close-btn" id="lc-tracker-close-btn">Dismiss</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Initialize and run confetti
  const activeCanvas = overlay.querySelector('.lc-tracker-canvas');
  const confetti = new ConfettiEngine(activeCanvas);
  
  // Show overlay with class triggers
  setTimeout(() => {
    overlay.classList.add('show');
    // Spawn confetti after checkmark starts drawing
    setTimeout(() => {
      confetti.spawn();
      confetti.animate();
    }, 600);
  }, 100);

  // Close overlay functionality
  const closeOverlay = () => {
    overlay.classList.add('hide');
    confetti.destroy();
    setTimeout(() => {
      overlay.remove();
    }, 600);
  };

  // Close triggers
  overlay.querySelector('#lc-tracker-close-btn').addEventListener('click', closeOverlay);
  
  // Auto-dismiss after 7 seconds
  const autoDismissTimeout = setTimeout(closeOverlay, 7000);

  // Clear timeout if clicked
  overlay.querySelector('#lc-tracker-close-btn').addEventListener('click', () => {
    clearTimeout(autoDismissTimeout);
  });
};

// 3. Listen to events from the page context (MAIN world)
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== 'LEETCODE_SUBMISSION_ACCEPTED') return;

  const { titleSlug } = event.data;
  if (!titleSlug) return;

  console.log(`[LeetCode Tracker] Submission detected for: ${titleSlug}. Verifying...`);

  // Message background.js to verify if this is the daily challenge
  chrome.runtime.sendMessage({
    type: 'VERIFY_SUBMISSION',
    titleSlug: titleSlug
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[LeetCode Tracker] Background worker communication error:', chrome.runtime.lastError);
      return;
    }

    if (response && response.isDailyCompleted) {
      console.log('[LeetCode Tracker] Daily challenge successfully completed! Displaying animation.');
      showCompletionOverlay(response.dailyData, response.streak);
    } else {
      console.log('[LeetCode Tracker] Submission verified. Not the uncompleted daily challenge or already marked complete today.');
    }
  });
});
