// iPhone-style drum roller
// Usage: new DrumRoller(containerEl, items, initialIndex)

function DrumRoller(el, items, initialIdx) {
  this.el = el;
  this.items = items;
  this.idx = initialIdx || 0;
  this._build();
  this._bind();
  this.scrollTo(this.idx, false);
}

DrumRoller.ITEM_H = 44;

DrumRoller.prototype._build = function() {
  this.el.innerHTML = '';
  this.el.className = 'drum-roller';

  // Fade overlays (top + bottom gradient)
  var fadeTop = document.createElement('div');
  fadeTop.className = 'drum-fade drum-fade-top';
  var fadeBot = document.createElement('div');
  fadeBot.className = 'drum-fade drum-fade-bot';

  // Selection highlight bar
  var bar = document.createElement('div');
  bar.className = 'drum-bar';

  // Scroll track
  this.track = document.createElement('div');
  this.track.className = 'drum-track';

  var H = DrumRoller.ITEM_H;
  // Padding items so first/last can centre
  var pad = 2;
  for (var p = 0; p < pad; p++) {
    var sp = document.createElement('div');
    sp.className = 'drum-item drum-pad';
    this.track.appendChild(sp);
  }
  for (var i = 0; i < this.items.length; i++) {
    var div = document.createElement('div');
    div.className = 'drum-item';
    div.textContent = this.items[i];
    this.track.appendChild(div);
  }
  for (var p2 = 0; p2 < pad; p2++) {
    var sp2 = document.createElement('div');
    sp2.className = 'drum-item drum-pad';
    this.track.appendChild(sp2);
  }

  this.el.appendChild(this.track);
  this.el.appendChild(bar);
  this.el.appendChild(fadeTop);
  this.el.appendChild(fadeBot);
};

DrumRoller.prototype.scrollTo = function(idx, animate) {
  var H = DrumRoller.ITEM_H;
  var pad = 2;
  var top = (pad + idx) * H - (2 * H); // centre = 2 visible rows above
  if (animate) {
    this.track.style.transition = 'transform 0.18s cubic-bezier(0.25,0.46,0.45,0.94)';
  } else {
    this.track.style.transition = 'none';
  }
  this.track.style.transform = 'translateY(' + (-top) + 'px)';
  this._hilite(idx);
  this.idx = idx;
};

DrumRoller.prototype._hilite = function(idx) {
  var pad = 2;
  var all = this.track.querySelectorAll('.drum-item:not(.drum-pad)');
  all.forEach(function(el, i) {
    var dist = Math.abs(i - idx);
    el.classList.toggle('drum-sel', i === idx);
    el.classList.toggle('drum-near', dist === 1);
    el.classList.toggle('drum-far', dist === 2);
    el.classList.toggle('drum-gone', dist >= 3);
  });
};

DrumRoller.prototype._bind = function() {
  var self = this;
  var H = DrumRoller.ITEM_H;
  var startY, startIdx, lastY, velY, lastT, rafId, isDragging;

  function clamp(i) { return Math.max(0, Math.min(self.items.length - 1, i)); }

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms || 6);
  }

  function onStart(y) {
    isDragging = true;
    startY = y;
    lastY = y;
    startIdx = self.idx;
    velY = 0;
    lastT = Date.now();
    self.track.style.transition = 'none';
    cancelAnimationFrame(rafId);
  }

  function onMove(y) {
    if (!isDragging) return;
    var dy = y - lastY;
    var now = Date.now();
    var dt = now - lastT || 1;
    velY = dy / dt; // px/ms
    lastY = y;
    lastT = now;

    var delta = startY - y;
    var rawIdx = startIdx + delta / H;
    var newIdx = clamp(Math.round(rawIdx));
    if (newIdx !== self.idx) {
      vibrate(6);
      self._hilite(newIdx);
      self.idx = newIdx;
    }
    // Smooth drag follow
    var top = (2 + Math.min(Math.max(rawIdx, 0), self.items.length - 1)) * H - 2 * H;
    self.track.style.transform = 'translateY(' + (-top) + 'px)';
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    // Momentum
    var momentum = velY * 80; // ms worth of velocity
    var finalRaw = self.idx - momentum / H;
    var finalIdx = clamp(Math.round(finalRaw));
    self.scrollTo(finalIdx, true);
    vibrate(8);
  }

  // Touch
  self.el.addEventListener('touchstart', function(e) {
    onStart(e.touches[0].clientY);
  }, { passive: true });
  self.el.addEventListener('touchmove', function(e) {
    e.preventDefault();
    onMove(e.touches[0].clientY);
  }, { passive: false });
  self.el.addEventListener('touchend', function() { onEnd(); });

  // Mouse (desktop fallback)
  self.el.addEventListener('mousedown', function(e) {
    onStart(e.clientY);
    function mm(e2) { onMove(e2.clientY); }
    function mu() { onEnd(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); }
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  });
};

DrumRoller.prototype.getValue = function() {
  return this.items[this.idx];
};

DrumRoller.prototype.setByValue = function(val, animate) {
  var i = this.items.indexOf(String(val));
  if (i >= 0) this.scrollTo(i, animate != null ? animate : false);
};
