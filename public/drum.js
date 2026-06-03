// iPhone-style drum picker — dark theme, momentum scroll, haptic tick
function DrumRoller(el, items, initialIdx) {
  this.el    = el;
  this.items = items;
  this.idx   = Math.max(0, Math.min(initialIdx || 0, items.length - 1));
  this._build();
  this._attach();
  this._render(this.idx);
}

DrumRoller.H = 52; // px per item
DrumRoller.VISIBLE = 5; // odd number so centre is exact

DrumRoller.prototype._build = function () {
  var H = DrumRoller.H, V = DrumRoller.VISIBLE;
  this.el.innerHTML = '';
  this.el.className = 'dr-wrap';

  // Selection pill
  var pill = document.createElement('div');
  pill.className = 'dr-pill';
  this.el.appendChild(pill);

  // Scroll container
  this.scroller = document.createElement('div');
  this.scroller.className = 'dr-scroller';

  // Padding spacers (2 above, 2 below so first/last item can centre)
  var pad = Math.floor(V / 2);
  for (var p = 0; p < pad; p++) {
    this.scroller.appendChild(this._makeItem('', true));
  }
  for (var i = 0; i < this.items.length; i++) {
    this.scroller.appendChild(this._makeItem(this.items[i], false));
  }
  for (var p2 = 0; p2 < pad; p2++) {
    this.scroller.appendChild(this._makeItem('', true));
  }

  this.el.appendChild(this.scroller);

  // Top + bottom gradient fade overlays
  var fadeT = document.createElement('div'); fadeT.className = 'dr-fade dr-fade-top';
  var fadeB = document.createElement('div'); fadeB.className = 'dr-fade dr-fade-bot';
  this.el.appendChild(fadeT);
  this.el.appendChild(fadeB);
};

DrumRoller.prototype._makeItem = function (text, isPad) {
  var el = document.createElement('div');
  el.className = isPad ? 'dr-item dr-pad' : 'dr-item';
  el.textContent = text;
  return el;
};

DrumRoller.prototype._render = function (idx) {
  var H = DrumRoller.H;
  var pad = Math.floor(DrumRoller.VISIBLE / 2);
  var items = this.scroller.querySelectorAll('.dr-item:not(.dr-pad)');

  // Position scroller so item[idx] is centred
  var offset = -(idx * H);
  this.scroller.style.transform = 'translateY(' + offset + 'px)';

  items.forEach(function (el, i) {
    var dist = Math.abs(i - idx);
    el.className = 'dr-item';
    if (dist === 0) el.classList.add('dr-sel');
    else if (dist === 1) el.classList.add('dr-near');
    else if (dist === 2) el.classList.add('dr-far');
    else el.classList.add('dr-gone');
  });

  this.idx = idx;
};

DrumRoller.prototype._clamp = function (i) {
  return Math.max(0, Math.min(this.items.length - 1, i));
};

DrumRoller.prototype._vibrate = function () {
  if (navigator.vibrate) navigator.vibrate(6);
};

DrumRoller.prototype._attach = function () {
  var self = this;
  var H = DrumRoller.H;
  var startY, lastY, startIdx, vel, lastT, moving, rafId;

  function pointerStart(y) {
    moving   = true;
    startY   = y;
    lastY    = y;
    startIdx = self.idx;
    vel      = 0;
    lastT    = Date.now();
    self.scroller.style.transition = 'none';
    cancelAnimationFrame(rafId);
  }

  function pointerMove(y) {
    if (!moving) return;
    var now = Date.now();
    var dt  = Math.max(1, now - lastT);
    vel     = (y - lastY) / dt;   // px/ms, positive = dragging down = going to smaller idx
    lastY   = y;
    lastT   = now;

    var drag  = startY - y;       // positive = dragged up = higher idx
    var rawIdx = startIdx + drag / H;
    var clamped = self._clamp(rawIdx);

    // Live follow — smooth fractional position
    var offset = -(clamped * H);
    self.scroller.style.transform = 'translateY(' + offset + 'px)';

    // Tick haptic when crossing a whole number
    var newIdx = self._clamp(Math.round(rawIdx));
    if (newIdx !== self.idx) {
      self._vibrate();
      self._render(newIdx);
    }
  }

  function pointerEnd() {
    if (!moving) return;
    moving = false;

    // Momentum: how many items to coast
    var coast   = vel * 120;          // tune feel here
    var finalRaw = self.idx - coast / H;
    var finalIdx = self._clamp(Math.round(finalRaw));

    self.scroller.style.transition = 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    self._render(finalIdx);
    if (navigator.vibrate) navigator.vibrate(10);
  }

  // Touch
  self.el.addEventListener('touchstart', function (e) {
    pointerStart(e.touches[0].clientY);
  }, { passive: true });

  self.el.addEventListener('touchmove', function (e) {
    e.preventDefault();
    pointerMove(e.touches[0].clientY);
  }, { passive: false });

  self.el.addEventListener('touchend', pointerEnd, { passive: true });

  // Mouse (desktop)
  self.el.addEventListener('mousedown', function (e) {
    pointerStart(e.clientY);
    function onMove(e2) { pointerMove(e2.clientY); }
    function onUp()    { pointerEnd(); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    e.preventDefault();
  });
};

DrumRoller.prototype.getValue = function () {
  return this.items[this.idx];
};

DrumRoller.prototype.setByValue = function (val) {
  var i = this.items.indexOf(String(val));
  if (i >= 0) {
    this.scroller.style.transition = 'none';
    this._render(i);
  }
};
