/* ============================================================
   ZIB — the friend who lives in Word Land
   ------------------------------------------------------------
   One file. Drop it in js/ and add it above the game's own
   script, after wordland-audio.js:

       <script src="js/wordland-audio.js"></script>
       <script src="js/mascot.js"></script>
       <script src="js/wordland.js"></script>

   It brings its own stylesheet, so there is nothing else to
   link. It works on its own too — if WLAudio or Profiles are
   missing, Zib still appears and still shows his words, he
   just doesn't speak.

   ── HOW ZIB TALKS ────────────────────────────────────────
   Every line goes through WLAudio.phrase(), which looks for

       audio/wordland/phrases/<the-line-as-a-filename>.mp3

   and falls back to the computer voice until you've recorded
   it. So "Take your time." is take-your-time.mp3. Zib.LINES
   at the bottom lists every line and its filename, and
   Zib.script() prints the whole lot to the console.

   Lines that end in a child's name go through WLAudio.cheer()
   instead, which plays praise/<line>.mp3 then players/playerN.mp3.
   Those are marked NAME in the script.

   ── THE FIVE CALLS YOU NEED ──────────────────────────────
       Zib.mount(el, {size:150})         put him somewhere
       Zib.say('Listen.')                a line, with a bubble
       Zib.sequence([...])               several lines in turn
       Zib.mood('happy')                 change his face
       Zib.helper()                      the little corner Zib

   ── HIS BAG ──────────────────────────────────────────────
       Zib.bag('m')      shows the letter m poking out
       Zib.bag(null)     empty again
   The satchel is the same bag from the story: the letters a
   child finds are the letters Zib is carrying home.
   ============================================================ */

const Zib = (function () {

  /* ── the palette, taken from the games so he belongs ──────
     purple  Word Land   teal  Spell It   gold  Write It
     Zib wears all three, because he is in all three.        */
  const C = {
    fur1:  '#C9B6F7',  fur2:  '#8C6FD1',  furEdge: '#7A5CC0',
    cream: '#FFF8E7',  ink:   '#2E2A55',  rose:    '#F8A5C2',
    gold:  '#F0B429',  teal:  '#4ECDC4',  tealDk:  '#34A69F',
    purple:'#5B4A8A',  ghost: '#F3EEFB',  lilac:   '#E8DFF5', lav: '#9B8BB4'
  };

  const MOODS = ['idle','happy','cheer','think','oops','sleep','wave','point','proud'];

  let uid = 0;                 // gradients need their own ids per copy
  const instances = [];
  let lead = null;             // who does the talking
  let last = null;             // the last thing said, for the repeat tap
  let styled = false;

  const reduced = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
  };

  /* ── speaking ─────────────────────────────────────────── */
  function audio() { return (typeof WLAudio !== 'undefined') ? WLAudio : null }

  /* Lines that end in a child's name, filled in at the bottom of
     this file. They live in praise/ and are played as two halves. */
  const NAMED = new Set();

  function speak(text) {
    const A = audio();
    if (!A) return Promise.resolve();
    try {
      if (NAMED.has(text)) {
        /* "Nice to meet you" + "Sarah" — two recordings, one sentence.
           WLAudio.seq is all-or-nothing: if either half is missing it
           speaks the whole line instead, so the two voices never meet
           in the middle. With nobody chosen we just say it plain. */
        const slot = A.playerSlot ? A.playerSlot() : 0;
        const who  = A.playerName ? A.playerName() : '';
        if (slot && who && A.seq) {
          return A.seq([['praise', text], ['players', 'player' + slot]],
                       text + ', ' + who, 0.8, 1.18) || Promise.resolve();
        }
      }
      return A.phrase(text, 0.8, 1.18) || Promise.resolve();
    } catch (e) { return Promise.resolve() }
  }

  /* Long enough to read along with, never so long a child waits. */
  function dwell(text) {
    const words = String(text).trim().split(/\s+/).length;
    return Math.min(6000, Math.max(1700, 520 + words * 400));
  }

  /* ── the drawing ──────────────────────────────────────── */
  function figure(id) {
    const g = n => 'zib' + id + '-' + n;
    return `
<svg class="zib-svg" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${g('fur')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.fur1}"/><stop offset="1" stop-color="${C.fur2}"/>
    </linearGradient>
    <radialGradient id="${g('glow')}">
      <stop offset="0" stop-color="${C.gold}" stop-opacity=".55"/>
      <stop offset="1" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <ellipse class="zib-shadow" cx="70" cy="128" rx="32" ry="5.5" fill="${C.purple}" opacity=".13"/>

  <!-- The letter lamps. They are how you know what he is feeling:
       they glow while he talks, one droops while he thinks, and
       both sag when something didn't work. -->
  <g class="zib-ant zib-ant-l">
    <path d="M60,42 C52,30 48,24 47,17" stroke="${C.furEdge}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle class="zib-halo" cx="47" cy="15" r="13" fill="url(#${g('glow')})"/>
    <circle class="zib-bulb" cx="47" cy="15" r="6.5" fill="${C.gold}"/>
  </g>
  <g class="zib-ant zib-ant-r">
    <path d="M80,42 C88,30 92,24 93,17" stroke="${C.furEdge}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle class="zib-halo" cx="93" cy="15" r="13" fill="url(#${g('glow')})"/>
    <circle class="zib-bulb" cx="93" cy="15" r="6.5" fill="${C.gold}"/>
  </g>

  <g class="zib-body">
    <!-- arms, drawn first so the body edge tucks them in -->
    <ellipse class="zib-arm zib-arm-l" cx="27" cy="72" rx="10.5" ry="8" fill="${C.fur2}"/>
    <ellipse class="zib-arm zib-arm-r" cx="113" cy="88" rx="10.5" ry="8" fill="${C.fur2}"/>

    <path d="M70,34 C101,34 111,55 111,80 C111,106 94,121 70,121
             C46,121 29,106 29,80 C29,55 39,34 70,34 Z" fill="url(#${g('fur')})"/>

    <!-- the face plate, so the eyes carry at any size -->
    <ellipse cx="70" cy="76" rx="29" ry="27" fill="${C.cream}"/>

    <!-- the satchel he carries the lost letters home in -->
    <path d="M52,50 Q37,66 33,86" stroke="${C.teal}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <rect x="19" y="88" width="27" height="23" rx="8" fill="${C.teal}"/>
    <rect x="17" y="84" width="31" height="12" rx="6" fill="${C.tealDk}"/>
    <circle cx="32.5" cy="95" r="3" fill="${C.gold}"/>
    <text class="zib-letter" x="32.5" y="107" text-anchor="middle"
          font-family="Andika, Georgia, serif" font-size="17" font-weight="700" fill="${C.cream}"></text>

    <!-- eyes: one set per feeling, swapped by CSS -->
    <g class="zib-eyes zib-eyes-open">
      <ellipse cx="59" cy="71" rx="9.5" ry="10.5" fill="#fff"/>
      <ellipse cx="81" cy="71" rx="9.5" ry="10.5" fill="#fff"/>
      <circle class="zib-pupil" cx="60" cy="73" r="5.4" fill="${C.ink}"/>
      <circle class="zib-pupil" cx="82" cy="73" r="5.4" fill="${C.ink}"/>
      <circle cx="62.5" cy="69.5" r="2.2" fill="#fff"/>
      <circle cx="84.5" cy="69.5" r="2.2" fill="#fff"/>
      <g class="zib-lids">
        <ellipse cx="59" cy="71" rx="10" ry="11" fill="${C.cream}"/>
        <ellipse cx="81" cy="71" rx="10" ry="11" fill="${C.cream}"/>
      </g>
    </g>
    <g class="zib-eyes zib-eyes-arc" stroke="${C.ink}" stroke-width="3.6" stroke-linecap="round" fill="none">
      <path d="M51,73 Q59,63 67,73"/><path d="M73,73 Q81,63 89,73"/>
    </g>
    <g class="zib-eyes zib-eyes-shut" stroke="${C.ink}" stroke-width="3.6" stroke-linecap="round" fill="none">
      <path d="M51,71 Q59,79 67,71"/><path d="M73,71 Q81,79 89,71"/>
    </g>

    <ellipse class="zib-cheek" cx="47" cy="85" rx="7" ry="4.6" fill="${C.rose}" opacity=".8"/>
    <ellipse class="zib-cheek" cx="93" cy="85" rx="7" ry="4.6" fill="${C.rose}" opacity=".8"/>

    <!-- mouths -->
    <g class="zib-mouth zib-mouth-smile">
      <path d="M63,88 Q70,96 77,88" stroke="${C.ink}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    </g>
    <g class="zib-mouth zib-mouth-open">
      <path d="M62,86 Q70,102 78,86 Z" fill="#4A3F6B"/>
      <path d="M66,95 Q70,100 74,95 Z" fill="${C.rose}"/>
    </g>
    <g class="zib-mouth zib-mouth-small">
      <ellipse cx="70" cy="91" rx="4.5" ry="5.5" fill="#4A3F6B"/>
    </g>
    <g class="zib-mouth zib-mouth-wobble">
      <path d="M62,91 Q66,86 70,91 Q74,96 78,91" stroke="${C.ink}" stroke-width="3" stroke-linecap="round" fill="none"/>
    </g>
  </g>

  <g class="zib-zzz" fill="${C.fur2}" font-family="Fredoka, sans-serif" font-weight="700">
    <text x="106" y="44" font-size="15">z</text>
    <text x="118" y="31" font-size="11">z</text>
  </g>
</svg>`;
  }

  /* ── the stylesheet, injected once ────────────────────── */
  function style() {
    if (styled) return; styled = true;
    const css = `
.zib{--zib-size:150px;display:flex;flex-direction:column;align-items:center;gap:8px;
  font-family:'Fredoka',system-ui,sans-serif;pointer-events:none}
.zib *{box-sizing:border-box}
.zib-svg{width:var(--zib-size);height:var(--zib-size);display:block;overflow:visible}

/* Safari measures SVG transforms from the element's own box unless it
   is told otherwise, which throws every origin below out. */
.zib-svg g,.zib-svg ellipse,.zib-svg path,.zib-svg circle{transform-box:view-box}

/* he never sits perfectly still */
.zib-body{transform-origin:70px 110px;animation:zibFloat 3.4s ease-in-out infinite}
.zib-ant{transform-origin:70px 44px;animation:zibFloat 3.4s ease-in-out infinite}
@keyframes zibFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}

.zib-lids{transform-origin:70px 60px;animation:zibBlink 5.2s infinite}
@keyframes zibBlink{0%,95.5%,100%{transform:scaleY(0)}97%{transform:scaleY(1)}}

.zib-bulb{animation:zibPulse 2.6s ease-in-out infinite}
.zib-halo{animation:zibPulse 2.6s ease-in-out infinite}
@keyframes zibPulse{0%,100%{opacity:.75}50%{opacity:1}}

/* which face is showing */
.zib-eyes-arc,.zib-eyes-shut,.zib-mouth-open,.zib-mouth-small,.zib-mouth-wobble,.zib-zzz{display:none}
.zib.m-happy .zib-eyes-open,.zib.m-cheer .zib-eyes-open,.zib.m-proud .zib-eyes-open{display:none}
.zib.m-happy .zib-eyes-arc,.zib.m-cheer .zib-eyes-arc,.zib.m-proud .zib-eyes-arc{display:block}
.zib.m-happy .zib-mouth-smile,.zib.m-cheer .zib-mouth-smile,.zib.m-proud .zib-mouth-smile{display:none}
.zib.m-happy .zib-mouth-open,.zib.m-cheer .zib-mouth-open,.zib.m-proud .zib-mouth-open{display:block}

.zib.m-sleep .zib-eyes-open{display:none}
.zib.m-sleep .zib-eyes-shut{display:block}
.zib.m-sleep .zib-mouth-smile{display:none}
.zib.m-sleep .zib-mouth-small{display:block}
.zib.m-sleep .zib-zzz{display:block;animation:zibZzz 2.8s ease-in-out infinite}
@keyframes zibZzz{0%,100%{opacity:0;transform:translateY(4px)}45%{opacity:.9;transform:translateY(-4px)}}

.zib.m-think .zib-mouth-smile{display:none}
.zib.m-think .zib-mouth-wobble{display:block}
.zib.m-think .zib-ant-l{transform:rotate(-16deg) translateY(6px);transform-origin:60px 42px;animation:none}
.zib.m-think .zib-pupil{transform:translate(3px,-4px)}
.zib.m-think .zib-bulb,.zib.m-think .zib-halo{opacity:.4;animation:none}

.zib.m-oops .zib-mouth-smile{display:none}
.zib.m-oops .zib-mouth-small{display:block}
.zib.m-oops .zib-ant{transform:scaleY(.82) translateY(7px);animation:none}

/* the big feelings */
.zib.m-cheer .zib-body{animation:zibHop .5s ease-in-out 3}
@keyframes zibHop{0%,100%{transform:translateY(0) scale(1,1)}
  30%{transform:translateY(-16px) scale(.96,1.04)}60%{transform:translateY(0) scale(1.04,.96)}}
.zib.m-cheer .zib-arm-l{transform:rotate(-46deg) translate(-3px,-9px);transform-origin:35px 74px}
.zib.m-cheer .zib-arm-r{transform:rotate(46deg) translate(3px,-9px);transform-origin:105px 86px}

.zib.m-wave .zib-arm-r{transform-origin:105px 86px;animation:zibWave .62s ease-in-out 4}
@keyframes zibWave{0%,100%{transform:rotate(6deg)}50%{transform:rotate(-46deg) translateY(-7px)}}

.zib.m-point .zib-arm-r{transform:translate(10px,-3px) rotate(-20deg);transform-origin:105px 86px}
.zib.m-point .zib-body{animation:zibNudge 1.1s ease-in-out infinite}
@keyframes zibNudge{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}

.zib.m-proud .zib-arm-l{transform:rotate(-30deg) translateY(-7px);transform-origin:35px 74px}

.zib.talking .zib-mouth-open,.zib.talking .zib-mouth-smile{animation:zibTalk .28s ease-in-out infinite alternate}
@keyframes zibTalk{from{transform:scaleY(.72)}to{transform:scaleY(1.12)}}
.zib.talking .zib-mouth-open,.zib.talking .zib-mouth-smile{transform-origin:70px 89px}
.zib.talking .zib-bulb{animation:zibPulse .9s ease-in-out infinite}

/* what he says */
.zib-bubble{
  position:relative;max-width:min(300px,86vw);background:#fff;border:3px solid ${C.ghost};
  border-radius:20px;padding:12px 16px;text-align:center;
  font-size:17px;font-weight:600;line-height:1.35;color:${C.purple};
  box-shadow:0 6px 22px rgba(91,74,138,.14);
  opacity:0;transform:translateY(8px) scale(.94);transform-origin:50% 100%;
  transition:opacity .22s ease,transform .22s cubic-bezier(.2,1.5,.4,1);
  pointer-events:none;order:-1;
}
.zib-bubble::after{content:'';position:absolute;left:50%;margin-left:-9px;bottom:-11px;
  width:0;height:0;border:9px solid transparent;border-top-color:#fff}
.zib-bubble::before{content:'';position:absolute;left:50%;margin-left:-12px;bottom:-15px;
  width:0;height:0;border:12px solid transparent;border-top-color:${C.ghost}}
.zib-bubble.on{opacity:1;transform:none;pointer-events:auto}
.zib-bubble .zib-again{
  display:block;margin:7px auto 0;border:none;background:${C.ghost};color:${C.purple};
  font-family:inherit;font-size:13px;font-weight:600;border-radius:11px;padding:5px 12px;cursor:pointer}
.zib-bubble .zib-again:active{transform:translateY(1px)}

/* the little Zib who waits in the corner */
.zib-helper{
  position:fixed;right:max(14px,env(safe-area-inset-right));
  bottom:max(14px,env(safe-area-inset-bottom));z-index:600;
  display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none}
/* A rounded card rather than a circle, so his antennae — the part
   that carries the feeling — are not cropped off the top. */
.zib-helper .zib-btn{
  width:70px;height:74px;border-radius:24px;border:3px solid #fff;
  background:linear-gradient(160deg,#fff,${C.ghost});
  box-shadow:0 6px 20px rgba(91,74,138,.24);cursor:pointer;padding:0;pointer-events:auto;
  display:flex;align-items:center;justify-content:center;transition:transform .16s}
.zib-helper .zib-btn:active{transform:scale(.93)}
.zib-helper .zib-btn:focus-visible{outline:3px solid #778BEB;outline-offset:3px}
.zib-helper .zib{--zib-size:64px}
.zib-helper .zib-bubble{max-width:min(250px,72vw);font-size:15.5px;padding:10px 14px;order:0}
.zib-helper .zib-bubble::after,.zib-helper .zib-bubble::before{left:auto;right:22px;margin-left:0}
.zib-helper.nudge .zib-btn{animation:zibNudgeBtn 2.4s ease-in-out infinite}
@keyframes zibNudgeBtn{0%,88%,100%{transform:scale(1)}92%{transform:scale(1.09) rotate(-5deg)}96%{transform:scale(1.05) rotate(5deg)}}

.zib-hidden{display:none !important}

@media (prefers-reduced-motion:reduce){
  .zib *,.zib-helper .zib-btn{animation:none !important;transition:none !important}
  .zib-bubble{transition:none}
}`;
    const tag = document.createElement('style');
    tag.id = 'zib-style';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  /* ── one Zib somewhere on the page ────────────────────── */
  function make(host, opts) {
    style();
    opts = opts || {};
    const id = ++uid;

    const root = document.createElement('div');
    root.className = 'zib m-idle';
    if (opts.size) root.style.setProperty('--zib-size', opts.size + 'px');

    const fig = document.createElement('div');
    fig.className = 'zib-fig';
    fig.innerHTML = figure(id);

    const bubble = document.createElement('div');
    bubble.className = 'zib-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');

    root.appendChild(bubble);
    root.appendChild(fig);
    host.appendChild(root);

    const inst = {
      root, bubble, fig,
      letter: root.querySelector('.zib-letter'),
      timer: null,
      moodTimer: null,

      mood(m) {
        MOODS.forEach(x => root.classList.remove('m-' + x));
        root.classList.add('m-' + (MOODS.indexOf(m) < 0 ? 'idle' : m));
        return inst;
      },

      /* Big moods are moments, not states — they fall back to idle. */
      flash(m, ms) {
        clearTimeout(inst.moodTimer);
        inst.mood(m);
        inst.moodTimer = setTimeout(() => inst.mood('idle'), ms || 2200);
        return inst;
      },

      bubbleText(text, replay) {
        clearTimeout(inst.timer);
        if (!text) { bubble.classList.remove('on'); return inst; }
        bubble.textContent = text;
        if (replay !== false) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'zib-again';
          b.textContent = '🔊 again';
          b.onclick = e => { e.stopPropagation(); if (last) say(last.text, { mood: last.mood, on: inst }) };
          bubble.appendChild(b);
        }
        bubble.classList.add('on');
        return inst;
      },

      quiet() { clearTimeout(inst.timer); bubble.classList.remove('on'); return inst },

      bag(ch) {
        inst.letter.textContent = ch ? String(ch).toLowerCase().slice(0, 2) : '';
        return inst;
      },

      show() { root.classList.remove('zib-hidden'); return inst },
      hide() { inst.quiet(); root.classList.add('zib-hidden'); return inst },
      visible() { return !root.classList.contains('zib-hidden') },

      remove() {
        clearTimeout(inst.timer); clearTimeout(inst.moodTimer);
        root.remove();
        const i = instances.indexOf(inst); if (i > -1) instances.splice(i, 1);
        if (lead === inst) lead = instances[instances.length - 1] || null;
      }
    };

    instances.push(inst);
    if (opts.lead !== false) lead = inst;
    if (opts.mood) inst.mood(opts.mood);
    return inst;
  }

  /* ── say one thing ────────────────────────────────────── */
  function say(text, opts) {
    opts = opts || {};
    const inst = opts.on || lead;
    if (!inst) return speak(text);

    last = { text, mood: opts.mood };
    clearTimeout(inst.timer);

    if (opts.mood) inst.mood(opts.mood);
    inst.root.classList.add('talking');
    inst.bubbleText(text, opts.replay);

    const hold = opts.hold || dwell(text);
    const heard = speak(text);

    return new Promise(resolve => {
      inst.timer = setTimeout(() => {
        inst.root.classList.remove('talking');
        if (opts.keep !== true) inst.quiet();
        if (opts.then) inst.mood(opts.then);
        resolve(inst);
      }, hold);
      // if a recording runs long, let the mouth keep moving
      if (heard && heard.then) heard.then(() => {}, () => {});
    });
  }

  /* ── say several things, in turn ──────────────────────── */
  /*  Zib.sequence([
        ["Hi! I'm Zib.", 'wave'],
        ["What is your name?", 'idle']
      ]).then(...)                                          */
  function sequence(lines, opts) {
    opts = opts || {};
    const gap = opts.gap == null ? 320 : opts.gap;
    let chain = Promise.resolve();
    lines.forEach((l, i) => {
      const text = Array.isArray(l) ? l[0] : (l.text || l);
      const mood = Array.isArray(l) ? l[1] : l.mood;
      chain = chain.then(() => say(text, {
        mood, on: opts.on,
        keep: i === lines.length - 1 ? opts.keep : false
      })).then(() => new Promise(r => setTimeout(r, gap)));
    });
    return chain;
  }

  /* ── the corner Zib ───────────────────────────────────────
     A child who is stuck taps him and hears the instruction
     again. If nothing at all happens for a while he leans in
     and offers, which is gentler than a screen that just sits
     there. Pass the hints for the screen you are on:

       Zib.helper({ hints:['Tap the letter you hear.','Listen.'] })
     ──────────────────────────────────────────────────────── */
  let helperBox = null, idleTimer = null;

  function helper(opts) {
    style();
    opts = opts || {};
    if (helperBox) { helperBox.hints(opts.hints || []); return helperBox }

    const wrap = document.createElement('div');
    wrap.className = 'zib-helper';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zib-btn';
    btn.setAttribute('aria-label', 'Ask Zib');
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    const inst = make(btn, { size: 74, lead: false });
    // the bubble belongs to the corner, not inside the little round button
    wrap.insertBefore(inst.bubble, btn);

    let hints = opts.hints || [];
    let at = 0;

    function offer() {
      wrap.classList.remove('nudge');
      const line = last ? last.text : (hints[at++ % Math.max(1, hints.length)] || LINE.help);
      say(line, { on: inst, mood: 'point', then: 'idle' });
      wake();
    }

    btn.onclick = offer;

    function wake() {
      clearTimeout(idleTimer);
      wrap.classList.remove('nudge');
      if (opts.nudgeAfter === false) return;
      idleTimer = setTimeout(() => wrap.classList.add('nudge'), opts.nudgeAfter || 22000);
    }
    ['pointerdown', 'keydown'].forEach(e => document.addEventListener(e, wake, { passive: true }));
    wake();

    helperBox = {
      el: wrap, zib: inst,
      hints(h) { hints = h || []; at = 0; return helperBox },
      say(t, o) { return say(t, Object.assign({ on: inst }, o || {})) },
      hide() { wrap.classList.add('zib-hidden'); return helperBox },
      show() { wrap.classList.remove('zib-hidden'); return helperBox },
      remove() { clearTimeout(idleTimer); inst.remove(); wrap.remove(); helperBox = null }
    };
    return helperBox;
  }

  /* ════════════════════════════════════════════════════════
     EVERY LINE ZIB SAYS
     --------------------------------------------------------
     Grouped by where it is heard. `name:true` means the line
     runs into the child's name and lives in praise/ rather
     than phrases/ — record those RISING, as though the
     sentence has not finished yet.

     Zib.script() prints this as a recording list.
     ════════════════════════════════════════════════════════ */
  const LINES = [
    /* ── meeting him, on a new profile ── */
    { t: "Hi! I'm Zib.",                  g: 'Meeting Zib', tier: 1 },
    { t: "I live in Word Land.",          g: 'Meeting Zib', tier: 1 },
    { t: "Will you be my friend?",        g: 'Meeting Zib', tier: 1 },
    { t: "What is your name?",            g: 'Meeting Zib', tier: 1, have: true },
    { t: "Now pick a face for you.",      g: 'Meeting Zib', tier: 1 },
    { t: "Tap the one you like best.",    g: 'Meeting Zib', tier: 2 },
    { t: "Nice to meet you",              g: 'Meeting Zib', tier: 1, name: true },
    { t: "Welcome to your learning journey!", g: 'Meeting Zib', tier: 2, have: true },
    { t: "Come and play",                 g: 'Meeting Zib', tier: 3, name: true },

    /* ── the hub ── */
    { t: "Which game shall we play?",     g: 'Choosing a game', tier: 1 },
    { t: "Pick one and tap it.",          g: 'Choosing a game', tier: 2 },
    { t: "Off we go!",                    g: 'Choosing a game', tier: 2 },
    { t: "Bye for now!",                  g: 'Choosing a game', tier: 3 },
    { t: "See you soon",                  g: 'Choosing a game', tier: 3, name: true },

    /* ── Word Land ── */
    { t: "Choose a map.",                 g: 'Word Land', tier: 1 },
    { t: "Tap the glowing place.",        g: 'Word Land', tier: 1 },
    { t: "Help me find the lost letters.",g: 'Word Land', tier: 1 },
    { t: "Pop it in my bag.",             g: 'Word Land', tier: 2 },
    { t: "One more letter is home!",      g: 'Word Land', tier: 2 },
    { t: "My bag is full. Thank you!",    g: 'Word Land', tier: 3 },
    { t: "There is a new story page for you.", g: 'Word Land', tier: 3 },

    /* ── Write It ── */
    { t: "Start on the dot.",             g: 'Write It', tier: 1 },
    { t: "Follow the arrow.",             g: 'Write It', tier: 1 },
    { t: "Trace it with your finger.",    g: 'Write It', tier: 2 },
    { t: "Now try it on your own.",       g: 'Write It', tier: 2 },
    { t: "Nice and slow.",                g: 'Write It', tier: 3 },

    /* ── Spell It ── */
    { t: "Listen, then build the word.",  g: 'Spell It', tier: 1 },
    { t: "Sound it out.",                 g: 'Spell It', tier: 1 },
    { t: "Pick the one that fits.",       g: 'Spell It', tier: 2 },
    { t: "Which letter comes next?",      g: 'Spell It', tier: 3 },

    /* ── the ones he says everywhere ── */
    { t: "Listen.",                       g: 'Anywhere', tier: 1 },
    { t: "Your turn.",                    g: 'Anywhere', tier: 1 },
    { t: "Tap me if you need help.",      g: 'Anywhere', tier: 1 },
    { t: "Shall I say it again?",         g: 'Anywhere', tier: 1 },
    { t: "Take your time.",               g: 'Anywhere', tier: 1 },
    { t: "Ooh, nearly.",                  g: 'Anywhere', tier: 2 },
    { t: "That one was tricky.",          g: 'Anywhere', tier: 2 },
    { t: "Have another go.",              g: 'Anywhere', tier: 2, have: true },
    { t: "Look at that",                  g: 'Anywhere', tier: 2, name: true },
    { t: "Are you still there?",          g: 'Anywhere', tier: 3 },
    { t: "I'll wait.",                    g: 'Anywhere', tier: 3 },
    { t: "I like playing with you.",      g: 'Anywhere', tier: 3 }
  ];

  LINES.forEach(l => { if (l.name) NAMED.add(l.t) });

  /* The handful used often enough to deserve a short name. */
  const LINE = {
    hi:      "Hi! I'm Zib.",
    home:    "I live in Word Land.",
    friend:  "Will you be my friend?",
    name:    "What is your name?",
    face:    "Now pick a face for you.",
    met:     "Nice to meet you",
    game:    "Which game shall we play?",
    help:    "Tap me if you need help.",
    listen:  "Listen.",
    turn:    "Your turn.",
    again:   "Shall I say it again?",
    slow:    "Take your time.",
    nearly:  "Ooh, nearly.",
    wait:    "I'll wait.",
    bye:     "Bye for now!"
  };

  /* The filename a line will be looked for under. */
  function file(line) {
    const A = audio();
    const s = A && A.slug ? A.slug(line.t || line)
      : String(line.t || line).toLowerCase().replace(/['’.,!?]/g, '')
          .replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').replace(/-+/g, '-');
    return (line.name ? 'praise/' : 'phrases/') + s + '.mp3';
  }

  /* Everything to record, printed for a grown-up. */
  function script(tier) {
    const rows = LINES.filter(l => !l.have && (!tier || l.tier <= tier));
    const out = rows.map(l =>
      (l.name ? '↗ ' : '  ') + file(l).padEnd(44) + '"' + l.t + '"' + (l.name ? ' + their name' : ''));
    /* eslint-disable no-console */
    console.log('ZIB — ' + rows.length + ' recordings' + (tier ? ' (tier ' + tier + ' and under)' : ''));
    console.log('↗ means record it RISING, it runs into the child\'s name.\n');
    console.log(out.join('\n'));
    return rows;
  }

  return {
    mount: make, say, sequence, helper, script, file,
    mood: m => { if (lead) lead.mood(m); return lead },
    flash: (m, ms) => { if (lead) lead.flash(m, ms); return lead },
    bag: ch => { instances.forEach(i => i.bag(ch)); return lead },
    quiet: () => { instances.forEach(i => i.quiet()); return lead },
    lead: () => lead,
    setLead: i => { lead = i; return lead },
    all: () => instances.slice(),
    LINES, LINE, MOODS, C
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Zib };
