// ---------- Edit-window fun: sparkles, confetti, wiggle ----------

const prefersReducedMotion = () => appSettings.calm ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// sparkles, confetti and wiggles can be switched off on their own
const celebrationsOff = () => !appSettings.celebrations || prefersReducedMotion();

function getFxLayer() {
    let layer = document.getElementById('fx-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'fx-layer';
        layer.className = 'fx-layer';
        document.body.appendChild(layer);
    }
    return layer;
}

// Fling `count` bits outward from the centre of `fromEl`. makeBit
// returns the element for each bit; distance is the max fly radius.
function burstFrom(fromEl, count, distance, makeBit) {
    if (!fromEl) return;
    const rect = fromEl.getBoundingClientRect();
    burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, count, distance, makeBit);
}

// same, from a screen point (cx, cy)
function burstAt(cx, cy, count, distance, makeBit) {
    if (prefersReducedMotion()) return;
    const layer = getFxLayer();
    for (let i = 0; i < count; i++) {
        const bit = makeBit(i);
        const angle = Math.random() * Math.PI * 2;
        const dist = distance * (0.4 + Math.random() * 0.6);
        bit.style.left = cx + 'px';
        bit.style.top = cy + 'px';
        bit.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        bit.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
        bit.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        bit.style.setProperty('--dur', (0.6 + Math.random() * 0.6) + 's');
        layer.appendChild(bit);
        bit.addEventListener('animationend', () => bit.remove());
    }
}

// one bit (smoke, ash, an ember...) flying from a screen point along (dx, dy)
function flyBit(cls, x, y, dx, dy, dur) {
    const b = document.createElement('div');
    b.className = cls;
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.style.setProperty('--dx', dx + 'px');
    b.style.setProperty('--dy', dy + 'px');
    b.style.setProperty('--rot', (Math.random() * 120 - 60) + 'deg');
    b.style.setProperty('--dur', dur + 's');
    getFxLayer().appendChild(b);
    b.addEventListener('animationend', () => b.remove());
    return b;
}

function sparkleFrom(el, count = 7, extraClass = '') {
    if (celebrationsOff()) return;
    burstFrom(el, count, 38, () => {
        const sp = document.createElement('span');
        sp.className = ('fx-sparkle ' + extraClass).trim();
        sp.textContent = Math.random() < 0.5 ? '\u2726' : '\u2727';
        sp.style.fontSize = (10 + Math.random() * 10) + 'px';
        return sp;
    });
}

const CONFETTI_COLORS = ['#ff2e93', '#b57bff', '#5fe8c4', '#ffe066', '#9fdcff', '#ff9eb0'];

function confettiFrom(el) {
    if (celebrationsOff()) return;
    burstFrom(el, 70, 220, (i) => {
        const bit = document.createElement('span');
        bit.className = 'fx-confetti';
        bit.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        return bit;
    });
}
