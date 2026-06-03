// iPhone-style drum picker — white theme, finger-tracking, haptic tick
function DrumRoller(el, items, initialIdx) {
  this.el    = el;
  this.items = items;
  this.idx   = Math.max(0, Math.min(initialIdx || 0, items.length - 1));
  this._y    = 0;   // current translateY in px
  this._build();
  this._attach();
  this._jumpTo(this.idx);
}

DrumRoller.H = 50; // px per item

DrumRoller.prototype._build = function () {
  this.el.innerHTML = '';
  this.el.className = 'dr-wrap';

  // Pill
  var pill = document.createElement('div');
  pill.className = 'dr-pill';
  this.el.appendChild(pill);

  // Scroller
  this.scroller = document.createElement('div');
  this.scroller.className = 'dr-scroller';

  // 2 padding items top & bottom
  for (var p = 0; p < 2; p++) this.scroller.appendChild(this._mkItem('', true));
  for (var i = 0; i < this.items.length; i++) this.scroller.appendChild(this._mkItem(this.items[i], false));
  for (var p2 = 0; p2 < 2; p2++) this.scroller.appendChild(this._mkItem('', true));

  this.el.appendChild(this.scroller);

  // Fades
  var ft = document.createElement('div'); ft.className = 'dr-fade dr-fade-top';
  var fb = document.createElement('div'); fb.className = 'dr-fade dr-fade-bot';
  this.el.appendChild(ft);
  this.el.appendChild(fb);
};

DrumRoller.prototype._mkItem = function (text, isPad) {
  var el = document.createElement('div');
  el.className = isPad ? 'dr-item dr-pad' : 'dr-item';
  el.textContent = text;
  return el;
};

// Set position instantly (no transition)
DrumRoller.prototype._jumpTo = function (idx) {
  var H = DrumRoller.H;
  idx = this._clamp(idx);
  this._y = -idx * H;
  this.scroller.style.transition = 'none';
  this.scroller.style.transform  = 'translateY(' + this._y + 'px)';
  this.idx = idx;
  this._hilite(idx);
};

// Animate to index
DrumRoller.prototype._snapTo = function (idx) {
  var H = DrumRoller.H;
  idx = this._clamp(idx);
  this._y = -idx * H;
  this.scroller.style.transition = 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)';
  this.scroller.style.transform  = 'translateY(' + this._y + 'px)';
  this.idx = idx;
  this._hilite(idx);
};

DrumRoller.prototype._setY = function (y) {
  this.scroller.style.transition = 'none';
  this.scroller.style.transform  = 'translateY(' + y + 'px)';
  this._y = y;
  // Hilite whichever item is closest to centre
  var H   = DrumRoller.H;
  var idx = this._clamp(Math.round(-y / H));
  if (idx !== this.idx) {
    if (navigator.vibrate) navigator.vibrate(6);
    this.idx = idx;
    this._hilite(idx);
  }
};

DrumRoller.prototype._hilite = function (idx) {
  var items = this.scroller.querySelectorAll('.dr-item:not(.dr-pad)');
  items.forEach(function (el, i) {
    var d = Math.abs(i - idx);
    el.className = 'dr-item' +
      (d === 0 ? ' dr-sel' : d === 1 ? ' dr-near' : d === 2 ? ' dr-far' : ' dr-gone');
  });
};

DrumRoller.prototype._clamp = function (i) {
  return Math.max(0, Math.min(this.items.length - 1, i));
};

DrumRoller.prototype._attach = function () {
  var self = this;
  var H    = DrumRoller.H;
  var startY, startScrollY, lastY, lastT, vel, active;

  function start(clientY) {
    active       = true;
    startY       = clientY;
    lastY        = clientY;
    startScrollY = self._y;
    vel          = 0;
    lastT        = Date.now();
  }

  function move(clientY) {
    if (!active) return;
    var now = Date.now();
    var dt  = Math.max(1, now - lastT);
    vel     = (clientY - lastY) / dt;
    lastY   = clientY;
    lastT   = now;

    var delta = clientY - startY;
    var newY  = startScrollY + delta;

    // Rubber-band clamp at edges
    var minY = -(self.items.length - 1) * H;
    var maxY = 0;
    if (newY > maxY) newY = maxY + (newY - maxY) * 0.25;
    if (newY < minY) newY = minY + (newY - minY) * 0.25;

    self._setY(newY);
  }

  function end() {
    if (!active) return;
    active = false;

    // Momentum
    var coast   = vel * 100;
    var finalY  = self._y + coast;
    var finalIdx = self._clamp(Math.round(-finalY / H));
    self._snapTo(finalIdx);
    if (navigator.vibrate) navigator.vibrate(10);
  }

  // Touch
  self.el.addEventListener('touchstart', function (e) {
    start(e.touches[0].clientY);
  }, { passive: true });

  self.el.addEventListener('touchmove', function (e) {
    e.preventDefault();
    move(e.touches[0].clientY);
  }, { passive: false });

  self.el.addEventListener('touchend',   end, { passive: true });
  self.el.addEventListener('touchcancel',end, { passive: true });

  // Mouse
  self.el.addEventListener('mousedown', function (e) {
    start(e.clientY);
    e.preventDefault();
    function mm(e2) { move(e2.clientY); }
    function mu()   { end(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); }
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup',   mu);
  });
};

DrumRoller.prototype.getValue = function () {
  return this.items[this.idx];
};

DrumRoller.prototype.setByValue = function (val) {
  var i = this.items.indexOf(String(val));
  if (i >= 0) this._jumpTo(i);
};
