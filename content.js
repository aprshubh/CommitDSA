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
  
  const card = document.createElement('div');
  card.className = 'lc-tracker-card';

  const checkmarkContainer = document.createElement('div');
  checkmarkContainer.className = 'lc-tracker-checkmark-container';

  const checkmarkBg = document.createElement('div');
  checkmarkBg.className = 'lc-tracker-checkmark-bg';

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "checkmark-svg");
  svg.setAttribute("viewBox", "0 0 52 52");

  const circle = document.createElementNS(svgNS, "circle");
  circle.setAttribute("class", "checkmark-circle");
  circle.setAttribute("cx", "26");
  circle.setAttribute("cy", "26");
  circle.setAttribute("r", "25");
  circle.setAttribute("fill", "none");

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("class", "checkmark-check");
  path.setAttribute("fill", "none");
  path.setAttribute("d", "M14.1 27.2l7.1 7.2 16.7-16.8");

  svg.appendChild(circle);
  svg.appendChild(path);
  checkmarkContainer.appendChild(checkmarkBg);
  checkmarkContainer.appendChild(svg);

  const badge = document.createElement('div');
  badge.className = 'lc-tracker-badge';
  badge.textContent = 'Daily Challenge';

  const title = document.createElement('h1');
  title.className = 'lc-tracker-title';
  title.textContent = 'Accepted!';

  const problem = document.createElement('p');
  problem.className = 'lc-tracker-problem';

  const problemTitle = document.createElement('span');
  problemTitle.textContent = dailyData.title + " ";

  const problemDifficulty = document.createElement('span');
  problemDifficulty.className = 'lc-tracker-difficulty ' + difficultyClass;
  problemDifficulty.textContent = dailyData.difficulty;

  problem.appendChild(problemTitle);
  problem.appendChild(problemDifficulty);

  const divider = document.createElement('div');
  divider.className = 'lc-tracker-divider';

  const streakCard = document.createElement('div');
  streakCard.className = 'lc-tracker-streak-card';

  const streakFire = document.createElement('div');
  streakFire.className = 'lc-tracker-streak-fire';
  streakFire.textContent = '🔥';

  const streakTextContainer = document.createElement('div');
  streakTextContainer.className = 'lc-tracker-streak-text';

  const streakVal = document.createElement('div');
  streakVal.className = 'lc-tracker-streak-val';
  streakVal.textContent = streak + ' Day' + (streak > 1 ? 's' : '') + ' Streak';

  const streakLbl = document.createElement('div');
  streakLbl.className = 'lc-tracker-streak-lbl';
  streakLbl.textContent = 'Keep it burning!';

  streakTextContainer.appendChild(streakVal);
  streakTextContainer.appendChild(streakLbl);
  streakCard.appendChild(streakFire);
  streakCard.appendChild(streakTextContainer);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'lc-tracker-close-btn';
  closeBtn.id = 'lc-tracker-close-btn';
  closeBtn.textContent = 'Dismiss';

  card.appendChild(checkmarkContainer);
  card.appendChild(badge);
  card.appendChild(title);
  card.appendChild(problem);
  card.appendChild(divider);
  card.appendChild(streakCard);
  card.appendChild(closeBtn);

  overlay.appendChild(card);

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
