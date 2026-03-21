// PadamPaapoma - Particle Sparkle Animation
(function() {
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
      this.reset();
    }

    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.size = Math.random() * 2.5 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = -Math.random() * 0.6 - 0.2;
      this.opacity = 0;
      this.maxOpacity = Math.random() * 0.7 + 0.3;
      this.fadeIn = true;
      this.fadeSpeed = Math.random() * 0.015 + 0.005;
      this.life = 0;
      this.maxLife = Math.random() * 200 + 100;
      this.twinkleSpeed = Math.random() * 0.05 + 0.02;
      this.twinkleOffset = Math.random() * Math.PI * 2;
      this.type = Math.floor(Math.random() * 3); // 0=circle, 1=star, 2=diamond
      this.color = this.getColor();
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.05;
    }

    getColor() {
      const colors = [
        [192, 132, 252], // light purple
        [168, 85, 247],  // purple
        [216, 180, 254], // lavender
        [255, 255, 255], // white
        [139, 92, 246],  // violet
        [221, 214, 254], // very light purple
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.life++;
      this.x += this.speedX;
      this.y += this.speedY;
      this.rotation += this.rotationSpeed;

      // Fade in/out
      if (this.life < this.maxLife * 0.2) {
        this.opacity = Math.min(this.maxOpacity, this.opacity + this.fadeSpeed);
      } else if (this.life > this.maxLife * 0.7) {
        this.opacity = Math.max(0, this.opacity - this.fadeSpeed);
      }

      // Twinkle effect
      const twinkle = Math.sin(this.life * this.twinkleSpeed + this.twinkleOffset) * 0.3 + 0.7;
      this.currentOpacity = this.opacity * twinkle;

      if (this.life >= this.maxLife || this.opacity <= 0) {
        this.reset();
      }
    }

    drawStar(ctx, x, y, size, points = 4) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.rotation);
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points;
        const r = i % 2 === 0 ? size : size * 0.4;
        if (i === 0) ctx.moveTo(r * Math.cos(angle), r * Math.sin(angle));
        else ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
      }
      ctx.closePath();
      ctx.restore();
    }

    draw(ctx) {
      const [r, g, b] = this.color;
      ctx.save();
      ctx.globalAlpha = this.currentOpacity;

      if (this.type === 0) {
        // Glowing circle
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
        gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
        gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.4)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright dot
        ctx.fillStyle = `rgba(255,255,255,0.9)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();

      } else if (this.type === 1) {
        // 4-pointed star
        ctx.fillStyle = `rgba(${r},${g},${b},1)`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
        this.drawStar(ctx, this.x, this.y, this.size * 1.5, 4);
        ctx.fill();

        // Cross sparkle lines
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.strokeStyle = `rgba(255,255,255,0.6)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-this.size * 2, 0);
        ctx.lineTo(this.size * 2, 0);
        ctx.moveTo(0, -this.size * 2);
        ctx.lineTo(0, this.size * 2);
        ctx.stroke();
        ctx.restore();

      } else {
        // Diamond sparkle
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation + Math.PI / 4);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2);
        gradient.addColorStop(0, `rgba(255,255,255,1)`);
        gradient.addColorStop(0.3, `rgba(${r},${g},${b},0.8)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // Mouse trail sparkles
  class MouseSparkle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 3 + 1;
      this.speedX = (Math.random() - 0.5) * 3;
      this.speedY = (Math.random() - 0.5) * 3 - 1;
      this.opacity = 1;
      this.decay = Math.random() * 0.03 + 0.02;
      const colors = [[192,132,252],[216,180,254],[255,255,255],[168,85,247]];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.rotation = Math.random() * Math.PI * 2;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.speedY += 0.05; // gravity
      this.opacity -= this.decay;
      this.size *= 0.97;
    }

    draw(ctx) {
      const [r, g, b] = this.color;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.opacity);
      ctx.fillStyle = `rgba(${r},${g},${b},1)`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    isDead() { return this.opacity <= 0; }
  }

  // Create particles
  const particles = [];
  const PARTICLE_COUNT = 80;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = new Sparkle();
    p.life = Math.random() * p.maxLife; // stagger start
    particles.push(p);
  }

  const mouseSparkles = [];

  // Mouse move handler
  let mouseTimer;
  document.addEventListener('mousemove', (e) => {
    clearTimeout(mouseTimer);
    for (let i = 0; i < 3; i++) {
      mouseSparkles.push(new MouseSparkle(e.clientX, e.clientY));
    }
    if (mouseSparkles.length > 150) mouseSparkles.splice(0, mouseSparkles.length - 150);
  });

  // Click burst
  document.addEventListener('click', (e) => {
    for (let i = 0; i < 20; i++) {
      mouseSparkles.push(new MouseSparkle(e.clientX, e.clientY));
    }
  });

  // Animation loop
  function animate() {
    ctx.clearRect(0, 0, W, H);

    // Draw floating particles
    particles.forEach(p => {
      p.update();
      p.draw(ctx);
    });

    // Draw mouse sparkles
    for (let i = mouseSparkles.length - 1; i >= 0; i--) {
      mouseSparkles[i].update();
      mouseSparkles[i].draw(ctx);
      if (mouseSparkles[i].isDead()) mouseSparkles.splice(i, 1);
    }

    requestAnimationFrame(animate);
  }

  animate();
})();
