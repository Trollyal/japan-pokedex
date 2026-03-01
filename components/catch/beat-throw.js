// components/catch/beat-throw.js — Beat 2: Power ring + rAF throw arc

import { sprite } from '../../lib/sprites.js';
import { sfx } from '../../lib/audio.js';
import { getAccentColor } from './catch-backgrounds.js';

const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Render Beat 2: Throw
 * @param {HTMLElement} container - The beat container div
 * @param {object} ctx
 * @param {string} ctx.ballName - Current ball sprite name (e.g. 'pokeball')
 * @param {string} ctx.spotType - Spot type for accent color
 * @param {HTMLElement} ctx.screen - The .catch-screen element
 * @param {function} ctx.announce - ARIA announce
 * @param {function} ctx.onThrown - Callback after ball reaches target (passes { timing })
 * @param {function} ctx.onClose - Close the flow
 * @returns {function} cleanup function
 */
export function render(container, ctx) {
  const accent = getAccentColor(ctx.spotType);
  let throwFired = false;
  let rafId = null;
  let fallbackTimer = null;

  container.innerHTML = /*html*/`
    <div class="zone-sky" style="justify-content:flex-end;padding-bottom:20px;">
      <div class="throw-hint"><span class="swipe-arrow"></span>Swipe up to throw!</div>
    </div>
    <div class="zone-target" id="target-zone">
      <div class="power-ring" id="power-ring" style="border-color:${accent}"></div>
    </div>
    <div class="zone-throw" id="throw-zone">
      <div class="throw-zone">
        <div class="throw-ball" id="throw-ball">${sprite(ctx.ballName || 'pokeball', 80)}</div>
      </div>
      <button class="btn-secondary throw-fallback" id="throw-btn">THROW!</button>
    </div>
  `;
  container.classList.add('beat-enter');

  const ring = container.querySelector('#power-ring');
  const ball = container.querySelector('#throw-ball');
  const throwZone = container.querySelector('#throw-zone');
  const targetZone = container.querySelector('#target-zone');
  const throwBtn = container.querySelector('#throw-btn');

  ctx.announce('Swipe up to throw!');

  // Show fallback button after 3s
  fallbackTimer = setTimeout(() => {
    if (!throwFired && throwBtn) throwBtn.classList.add('visible');
  }, 3000);

  // ===== SWIPE GESTURE =====
  let startY = 0, startTime = 0, dragging = false;

  function onTouchStart(e) {
    if (throwFired) return;
    e.preventDefault(); // suppress scroll/pull-to-refresh
    const point = e.touches[0];
    startY = point.clientY;
    startTime = Date.now();
    dragging = true;
    ball.classList.remove('spring-back');
  }

  function onTouchMove(e) {
    if (!dragging || throwFired) return;
    e.preventDefault();
    const point = e.touches[0];
    const deltaY = Math.min(0, point.clientY - startY);
    ball.style.transform = `translateY(${deltaY}px)`;
  }

  function onTouchEnd(e) {
    if (!dragging || throwFired) return;
    dragging = false;
    const point = e.changedTouches[0];
    const deltaY = startY - point.clientY; // positive = up
    const duration = Date.now() - startTime;

    if (deltaY > 60 && duration < 500) {
      ball.style.transform = '';
      executeThrow(duration, deltaY);
    } else {
      ball.classList.add('spring-back');
      ball.style.transform = '';
    }
  }

  // Mouse fallback for desktop
  function onMouseDown(e) {
    if (throwFired) return;
    startY = e.clientY;
    startTime = Date.now();
    dragging = true;
    ball.classList.remove('spring-back');
  }

  function onMouseMove(e) {
    if (!dragging || throwFired) return;
    const deltaY = Math.min(0, e.clientY - startY);
    ball.style.transform = `translateY(${deltaY}px)`;
  }

  function onMouseUp(e) {
    if (!dragging || throwFired) return;
    dragging = false;
    const deltaY = startY - e.clientY;
    const duration = Date.now() - startTime;

    if (deltaY > 60 && duration < 500) {
      ball.style.transform = '';
      executeThrow(duration, deltaY);
    } else {
      ball.classList.add('spring-back');
      ball.style.transform = '';
    }
  }

  // Touch listeners with passive: false on throw zone only
  throwZone.addEventListener('touchstart', onTouchStart, { passive: false });
  throwZone.addEventListener('touchmove', onTouchMove, { passive: false });
  throwZone.addEventListener('touchend', onTouchEnd);
  throwZone.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // Fallback button
  throwBtn.addEventListener('click', () => {
    if (!throwFired) executeThrow(300, 100);
  });

  // ===== EXECUTE THROW (guarded) =====
  function executeThrow(swipeDuration, swipeDistance) {
    if (throwFired) return; // double-throw guard
    throwFired = true;
    sfx('catch-throw');
    navigator.vibrate?.(50);

    // Read ring scale for timing feedback
    const timing = readRingTiming(ring);

    // Show timing label
    if (timing.label) {
      const label = document.createElement('div');
      label.className = `timing-label ${timing.label === 'Great!' ? 'great' : 'nice'}`;
      label.textContent = timing.label;
      targetZone.appendChild(label);
      label.addEventListener('animationend', () => label.remove());
      setTimeout(() => { if (label.parentNode) label.remove(); }, 700);
    }

    // Hide ring
    ring.style.display = 'none';

    if (REDUCED_MOTION) {
      // Skip animation — instant arrival
      ball.style.display = 'none';
      ctx.onThrown({ timing });
      return;
    }

    // rAF throw arc
    const ballRect = ball.getBoundingClientRect();
    const targetRect = targetZone.getBoundingClientRect();

    const startX = 0;
    const startYPos = 0;
    const endX = (targetRect.left + targetRect.width / 2) - (ballRect.left + ballRect.width / 2);
    const endY = (targetRect.top + targetRect.height / 2) - (ballRect.top + ballRect.height / 2);

    // Duration based on swipe velocity (faster swipe = faster arc)
    const velocity = swipeDistance / Math.max(swipeDuration, 1);
    const arcDuration = Math.max(350, Math.min(600, 600 - velocity * 150));

    ball.classList.add('animating');
    const arcStart = performance.now();

    function animateArc(now) {
      const elapsed = now - arcStart;
      const t = Math.min(1, elapsed / arcDuration);

      // Quadratic bezier: control point above midpoint for arc
      const cpX = (startX + endX) / 2;
      const cpY = Math.min(startYPos, endY) - 120; // arc peak

      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cpX + t * t * endX;
      const y = (1 - t) * (1 - t) * startYPos + 2 * (1 - t) * t * cpY + t * t * endY;
      const scale = 1 - t * 0.5; // 1.0 → 0.5

      ball.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

      if (t < 1) {
        rafId = requestAnimationFrame(animateArc);
      } else {
        // Arc complete — ball arrived at target
        ball.classList.remove('animating');
        ball.style.display = 'none';
        ctx.onThrown({ timing });
      }
    }

    rafId = requestAnimationFrame(animateArc);
  }

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    clearTimeout(fallbackTimer);
    throwZone.removeEventListener('touchstart', onTouchStart);
    throwZone.removeEventListener('touchmove', onTouchMove);
    throwZone.removeEventListener('touchend', onTouchEnd);
    throwZone.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}

/**
 * Read the current power ring scale to determine timing feedback.
 * Uses DOMMatrix to extract scale from computed transform.
 */
function readRingTiming(ring) {
  try {
    const transform = getComputedStyle(ring).transform;
    if (!transform || transform === 'none') return { scale: 2.5, label: null };
    const matrix = new DOMMatrix(transform);
    const scale = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
    if (scale <= 1.3) return { scale, label: 'Great!' };
    if (scale <= 1.8) return { scale, label: 'Nice!' };
    return { scale, label: null };
  } catch {
    return { scale: 2.5, label: null };
  }
}
