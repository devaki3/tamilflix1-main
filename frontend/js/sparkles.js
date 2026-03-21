// PadamPaapoma - Background Sparkles + Aesthetic Page Transitions
(function() {

  // ===== BACKGROUND SPARKLE CANVAS =====
  const canvas = document.createElement('canvas');
  canvas.id = 'sparkle-canvas';
  canvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  `;
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  let W = canvas.width = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });

  // Sparkle particle class
  class Sparkle {
    constructor() {
      this.reset(true);
    }

    reset(randomStart = false) {
      this.x = Math.random() * W;
      this.y = randomStart ? Math.random() * H : H + 10;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = -Math.random() * 0.5 - 0.1;
      this.opacity = 0;
      this.maxOpacity = Math.random() * 0.6 + 0.2;
      this.fadeSpeed = Math.random() * 0.01 + 0.004;
      this.life = 0;
      this.maxLife = Math.random() * 250 + 150;
      this.twinkleSpeed = Math.random() * 0.04 + 0.01;
      this.twinkleOffset = Math.random() * Math.PI * 2;
      this.type = Math.floor(Math.random() * 3);
      this.color = this.getColor();
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.03;
    }

    getColor() {
      const colors = [
        [192, 132, 252],
        [168, 85, 247],
        [216, 180, 254],
        [255, 255, 255],
        [139, 92, 246],
        [221, 214, 254],
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.life++;
      this.x += this.speedX;
      this.y += this.speedY;
      this.rotation += this.rotationSpeed;

      if (this.life < this.maxLife * 0.2) {
        this.opacity = Math.min(this.maxOpacity, this.opacity + this.fadeSpeed);
      } else if (this.life > this.maxLife * 0.7) {
        this.opacity = Math.max(0, this.opacity - this.fadeSpeed);
      }

      const twinkle = Math.sin(this.life * this.twinkleSpeed + this.twinkleOffset) * 0.3 + 0.7;
      this.currentOpacity = this.opacity * twinkle;

      if (this.life >= this.maxLife || this.y < -10) {
        this.reset();
      }
    }

    draw(ctx) {
      const [r, g, b] = this.color;
      ctx.save();
      ctx.globalAlpha = this.currentOpacity;

      if (this.type === 0) {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.5);
        gradient.addColorStop(0, `rgba(255,255,255,1)`);
        gradient.addColorStop(0.3, `rgba(${r},${g},${b},0.8)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
        ctx.fill();

      } else if (this.type === 1) {
        // 4-point star
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = `rgba(${r},${g},${b},1)`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.beginPath();
        const s = this.size * 1.5;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const rad = i % 2 === 0 ? s : s * 0.3;
          if (i === 0) ctx.moveTo(rad * Math.cos(angle), rad * Math.sin(angle));
          else ctx.lineTo(rad * Math.cos(angle), rad * Math.sin(angle));
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();

      } else {
        // Cross sparkle
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
        ctx.lineWidth = this.size * 0.6;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-this.size * 2, 0);
        ctx.lineTo(this.size * 2, 0);
        ctx.moveTo(0, -this.size * 2);
        ctx.lineTo(0, this.size * 2);
        ctx.stroke();
        // bright center
        ctx.fillStyle = `rgba(255,255,255,0.9)`;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // Create particles
  const particles = [];
  const PARTICLE_COUNT = 70;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = new Sparkle();
    p.life = Math.random() * p.maxLife;
    particles.push(p);
  }

  // Animation loop
  function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.update();
      p.draw(ctx);
    });
    requestAnimationFrame(animate);
  }

  animate();


  // ===== AESTHETIC PAGE TRANSITION OVERLAY =====
  const overlay = document.createElement('div');
  overlay.id = 'page-transition-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(ellipse at center, rgba(168,85,247,0.3) 0%, rgba(7,4,15,0.95) 70%);
    transition: opacity 0.4s ease;
  `;
  document.body.appendChild(overlay);

  // Sparkle burst canvas for transitions
  const burstCanvas = document.createElement('canvas');
  burstCanvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 10000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(burstCanvas);
  const bCtx = burstCanvas.getContext('2d');
  burstCanvas.width = window.innerWidth;
  burstCanvas.height = window.innerHeight;

  class BurstParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = Math.random() * 4 + 1;
      this.opacity = 1;
      this.decay = Math.random() * 0.02 + 0.01;
      const colors = [
        [192,132,252],[168,85,247],[216,180,254],
        [255,255,255],[139,92,246]
      ];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.type = Math.floor(Math.random() * 2);
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.1;
      this.vx *= 0.98;
      this.opacity -= this.decay;
      this.size *= 0.97;
    }

    draw(ctx) {
      const [r,g,b] = this.color;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.opacity);
      ctx.fillStyle = `rgba(${r},${g},${b},1)`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
      if (this.type === 0) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.opacity * 10);
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.restore();
      }
      ctx.restore();
    }

    isDead() { return this.opacity <= 0 || this.size < 0.3; }
  }

  let burstParticles = [];
  let burstAnimating = false;

  function runBurst(x, y, cb) {
    burstParticles = [];
    for (let i = 0; i < 60; i++) {
      burstParticles.push(new BurstParticle(x, y));
    }

    burstCanvas.style.opacity = '1';
    burstAnimating = true;

    function loop() {
      bCtx.clearRect(0, 0, burstCanvas.width, burstCanvas.height);
      for (let i = burstParticles.length - 1; i >= 0; i--) {
        burstParticles[i].update();
        burstParticles[i].draw(bCtx);
        if (burstParticles[i].isDead()) burstParticles.splice(i, 1);
      }
      if (burstParticles.length > 0) {
        requestAnimationFrame(loop);
      } else {
        burstCanvas.style.opacity = '0';
        burstAnimating = false;
        if (cb) cb();
      }
    }
    requestAnimationFrame(loop);
  }

  // ===== INJECT CSS FOR TRANSITIONS =====
  const style = document.createElement('style');
  style.textContent = `
    .page-slide-in {
      animation: pageSlideIn 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }
    .page-fade-in {
      animation: pageFadeIn 0.4s ease forwards;
    }
    @keyframes pageSlideIn {
      from {
        opacity: 0;
        transform: translateY(30px) scale(0.98);
        filter: blur(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
      }
    }
    @keyframes pageFadeIn {
      from { opacity: 0; filter: blur(8px); }
      to   { opacity: 1; filter: blur(0); }
    }
    .movie-card-clicked {
      animation: cardClick 0.3s ease forwards;
    }
    @keyframes cardClick {
      0%   { transform: scale(1); }
      40%  { transform: scale(0.92); filter: brightness(1.4); }
      100% { transform: scale(1); }
    }
    #page-movie, #page-quiz, #page-recommendation, #page-watch-together {
      transition: opacity 0.3s ease;
    }
  `;
  document.head.appendChild(style);

  // ===== INTERCEPT showPage to add transitions =====
  const _origShowPage = window.showPage;

  window.showPage = function(page, ...args) {
    const overlay = document.getElementById('page-transition-overlay');

    // Flash overlay
    overlay.style.opacity = '1';
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, 300);

    // Call original
    if (_origShowPage) {
      _origShowPage(page, ...args);
    }

    // Animate the new page in
    setTimeout(() => {
      const pageEl = document.getElementById(`page-${page}`);
      if (pageEl) {
        pageEl.classList.remove('page-slide-in');
        void pageEl.offsetWidth;
        pageEl.classList.add('page-slide-in');
        setTimeout(() => pageEl.classList.remove('page-slide-in'), 600);
      }
    }, 50);
  };

  // ===== ADD CLICK ANIMATION TO MOVIE CARDS =====
  document.addEventListener('click', function(e) {
    const card = e.target.closest('.movie-card');
    if (card) {
      // Get card center for burst
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Card click animation
      card.classList.add('movie-card-clicked');
      setTimeout(() => card.classList.remove('movie-card-clicked'), 400);

      // Sparkle burst at card center
      runBurst(cx, cy);
    }
  });

})();
