/* Shared bootstrap for the War of the Ring test suites.
   Keeps the dependency check and the file lookup in one place so both suites
   fail with something readable instead of a module stack trace. */
const fs = require("fs");
const path = require("path");

let jsdom;
try {
  jsdom = require("jsdom");
} catch (e) {
  console.error(`
These suites need jsdom (the only dependency). From this folder:

    npm install jsdom

If there is no package.json here yet, run "npm init -y" first.
`);
  process.exit(2);
}

/* Find the game file: an explicit argument wins, otherwise look beside the
   test for the newest war-of-the-ring HTML. */
function findGame() {
  const arg = process.argv[2];
  if (arg) {
    if (fs.existsSync(arg)) return arg;
    console.error(`No such file: ${arg}`);
    process.exit(2);
  }
  const dir = __dirname;
  const candidates = fs.readdirSync(dir)
    .filter(f => /^war-of-the-ring.*\.html$/i.test(f) || /^wotr.*\.html$/i.test(f))
    .sort();
  if (!candidates.length) {
    console.error(`
No War of the Ring HTML file found next to this test.

Either put the game file in ${dir}
or pass its path:

    node ${path.basename(process.argv[1])} path/to/war-of-the-ring_5_8.html
`);
    process.exit(2);
  }
  return path.join(dir, candidates[candidates.length - 1]);
}

const GAME_FILE = findGame();

/* Boot the game in a DOM, shimming the handful of APIs jsdom lacks. */
function boot(onReady, delay = 1200) {
  const { JSDOM, VirtualConsole } = jsdom;
  const errors = [];
  const vc = new VirtualConsole().on("jsdomError", e => errors.push(String(e.detail || e)));
  const dom = new JSDOM(fs.readFileSync(GAME_FILE, "utf8"), {
    runScripts: "dangerously", pretendToBeVisual: true, url: "https://local.test/", virtualConsole: vc
  });
  const w = dom.window;
  w.SVGElement.prototype.setPointerCapture = () => {};
  w.HTMLElement.prototype.setPointerCapture = () => {};
  w.SVGElement.prototype.releasePointerCapture = () => {};
  if (!w.ResizeObserver) w.ResizeObserver = class { observe() {} disconnect() {} };
  /* jsdom only gained PointerEvent recently; the gesture tests need it on every
     version, so synthesise one from MouseEvent when it is missing. */
  if (typeof w.PointerEvent !== "function") {
    w.PointerEvent = class PointerEvent extends w.MouseEvent {
      constructor(type, init) {
        init = init || {};
        super(type, init);
        this.pointerId = init.pointerId === undefined ? 1 : init.pointerId;
        this.pointerType = init.pointerType || "mouse";
        this.isPrimary = init.isPrimary !== false;
      }
    };
  }
  setTimeout(() => onReady({ w, d: w.document, errors, html: fs.readFileSync(GAME_FILE, "utf8") }), delay);
}

/* Tiny assertion collector. */
function reporter() {
  const report = [];
  return {
    ok(name, cond, extra) { report.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); },
    finish() {
      console.log(report.join("\n"));
      const failed = report.filter(r => r.startsWith("FAIL")).length;
      console.log(`\n${report.length - failed}/${report.length} passed  (${path.basename(GAME_FILE)})`);
      process.exit(failed ? 1 : 0);
    }
  };
}

module.exports = { boot, reporter, GAME_FILE, jsdom };
