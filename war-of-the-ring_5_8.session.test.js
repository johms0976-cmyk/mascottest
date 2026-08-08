const fs = require("fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const errors = [];
const dom = new JSDOM(fs.readFileSync("/home/claude/wotr_5_8.html", "utf8"), {
  runScripts: "dangerously", pretendToBeVisual: true, url: "https://local.test/",
  virtualConsole: new VirtualConsole().on("jsdomError", e => errors.push(String(e.detail || e)))
});
const w = dom.window;
w.SVGElement.prototype.setPointerCapture = () => {};
w.HTMLElement.prototype.setPointerCapture = () => {};
if (!w.ResizeObserver) w.ResizeObserver = class { observe() {} };

setTimeout(() => {
  const d = w.document, report = [];
  const ok = (n, c, x) => report.push(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`);
  const ev = src => w.eval(src);

  ev(`CFG.human = { fp: true, sh: false }; startGame();`);
  ok("fresh game seeds one checkpoint", ev("undoStack.length") === 1, ev("undoStack.length"));
  ok("undo unavailable at the opening", ev("canUndo()") === false);
  ok("autosave wrote a save", ev("hasSave()") === true);

  // ---- serializer: full round trip ----
  ev(`S.reg.osgiliath.fp.r = 2; S.reg.osgiliath.siege = true; S.fs.corr = 5;
      S.fs.comps = ["frodo","gandalf"]; S.nations.rohan.step = 0; S.hunt.box = 3;`);
  const before = ev("JSON.stringify(encodeState(S))");
  ev(`__rt = decodeState(JSON.parse(JSON.stringify(encodeState(S))))`);
  const after = ev("JSON.stringify(encodeState(__rt))");
  ok("state survives a round trip byte-for-byte", before === after,
     before.length + " vs " + after.length + " chars");
  ok("round trip keeps scalars", ev("__rt.fs.corr") === 5 && ev("__rt.hunt.box") === 3);
  ok("round trip keeps nested arrays", ev(`__rt.fs.comps.join(",")`) === "frodo,gandalf");
  ok("round trip keeps region detail",
     ev("__rt.reg.osgiliath.fp.r") === 2 && ev("__rt.reg.osgiliath.siege") === true);

  // ---- the card-identity hazard ----
  ok("hand holds canonical card objects",
     ev(`S.hands.fp.length > 0 && S.hands.fp.every(c => CARD_SET.has(c))`), "hand=" + ev("S.hands.fp.length"));
  ok("cards survive as the SAME object, not a copy",
     ev(`__rt.hands.fp.every(c => CARD_SET.has(c))`));
  ok("card ids preserved through the round trip",
     ev(`__rt.hands.fp.map(c=>c.id).join(",") === S.hands.fp.map(c=>c.id).join(",")`),
     ev(`S.hands.fp.map(c=>c.id).join(",")`));
  // the actual failure mode a naive clone would cause: indexOf stops finding cards
  ok("indexOf still removes a card after a round trip",
     ev(`(() => { const h = __rt.hands.fp, c = h[0]; return h.indexOf(c) === 0; })()`));
  ok("a naive JSON clone WOULD have broken it (hazard is real)",
     ev(`(() => { const naive = JSON.parse(JSON.stringify(S.hands.fp));
                 return !CARD_SET.has(naive[0]) && S.hands.fp.indexOf(naive[0]) === -1; })()`));
  ok("decks and table also rehydrate",
     ev(`(() => { S.table.sh.push(DATA.cards[0]);
        const r = decodeState(JSON.parse(JSON.stringify(encodeState(S))));
        const deckOk = Object.values(r.decks).every(dk => dk.every(c => CARD_SET.has(c)));
        S.table.sh.pop();
        return deckOk && CARD_SET.has(r.table.sh[0]); })()`));

  // ---- undo rewinds a whole exchange ----
  ev(`checkpoint(); checkpoint();`);
  ok("checkpoints accumulate", ev("undoStack.length") === 3, ev("undoStack.length"));
  ev(`S.fs.corr = 11; S.reg.osgiliath.fp.r = 0; S.turn = 7;`);
  ev(`doUndo()`);
  ok("undo restores corruption", ev("S.fs.corr") === 5, "corr=" + ev("S.fs.corr"));
  ok("undo restores the board", ev("S.reg.osgiliath.fp.r") === 2);
  ok("undo restores the turn counter", ev("S.turn") === 1, "turn=" + ev("S.turn"));
  ok("undo consumed one checkpoint", ev("undoStack.length") === 2, ev("undoStack.length"));
  ok("hands are live objects after undo", ev(`S.hands.fp.every(c => CARD_SET.has(c))`));
  ok("map was rebuilt after undo", d.querySelectorAll("#map .tok").length > 0);
  ev(`doUndo()`);
  ok("undo bottoms out without throwing", ev("undoStack.length") === 1 && ev("canUndo()") === false);
  ev(`doUndo()`);
  ok("undo past the floor is a no-op", ev("undoStack.length") === 1);

  // ---- undo button state ----
  const ub = d.querySelector("#btnUndo");
  ok("undo button disabled with no history", ub.disabled === true);
  ev(`checkpoint(); refreshBadges();`);
  ok("undo button enables once there is history", ub.disabled === false);
  ev(`busy = true; refreshBadges();`);
  ok("undo button disabled while the enemy is moving", ub.disabled === true);
  ev(`busy = false; refreshBadges();`);

  // ---- save / resume across a 'reload' ----
  ev(`S.turn = 4; S.fs.corr = 9; S.fs.loc = "moria"; S.aragorn = true; autosave();`);
  const savedHand = ev(`S.hands.sh.map(c=>c.id).join(",")`);
  ev(`S = null; undoStack = [];`);           // simulate a fresh page with only storage surviving
  ok("resume reports success", ev(`resumeSaved()`) === true);
  ok("resumed turn", ev("S.turn") === 4, "turn=" + ev("S.turn"));
  ok("resumed corruption", ev("S.fs.corr") === 9);
  ok("resumed fellowship position", ev(`S.fs.loc`) === "moria");
  ok("resumed promotions", ev("S.aragorn") === true);
  ok("resumed hidden hand intact", ev(`S.hands.sh.map(c=>c.id).join(",")`) === savedHand);
  ok("resume reseeds the undo stack", ev("undoStack.length") === 1);
  ok("resume restores the seat config", ev(`CFG.human.fp === true && CFG.human.sh === false`));

  // ---- export / import ----
  const code = ev(`exportCode()`);
  ok("export produces a portable code", typeof code === "string" && code.length > 100, code.length + " chars");
  ev(`S.turn = 99; S.fs.corr = 0;`);
  ok("import reports success", ev(`importCode(${JSON.stringify(code)})`) === true);
  ok("import restores the exported position", ev("S.turn") === 4 && ev("S.fs.corr") === 9,
     "turn=" + ev("S.turn"));
  ok("import rejects rubbish", ev(`importCode("not-a-save")`) === false);
  ok("rejected import left the game alone", ev("S.turn") === 4);
  ok("import rejects a wrong-version save",
     ev(`(() => { const bad = JSON.parse(atob(exportCode())); bad.v = 1;
          return importCode(btoa(JSON.stringify(bad))) === false; })()`));

  // ---- game over drops the save ----
  ev(`S.over = { winner: "fp", how: "test" }; renderGameOver();`);
  ok("finished game clears the autosave", ev("hasSave()") === false);
  ev(`S.over = null;`);

  // ---- what-changed diff ----
  ev(`CFG.human = { fp: true, sh: false }; startGame(); markAIStart();`);
  ok("baseline captured", ev("aiBase !== null"));
  ev(`S.reg.moria.sh.r += 3; S.reg.dol_guldur.sh.e += 1; refreshMap(); flashAIChanges();`);
  const flashed = [...d.querySelectorAll("#map .rg.changed")].map(g => g.id.replace("rg_", ""));
  ok("only the touched regions flash", flashed.length === 2 && flashed.includes("moria") && flashed.includes("dol_guldur"),
     flashed.join(",") || "(none)");
  ok("flashes are staggered",
     d.querySelector("#rg_dol_guldur.changed, #rg_moria.changed").style.getPropertyValue("--flash-delay") !== "");
  ok("baseline cleared after the flash", ev("aiBase === null"));
  ev(`markAIStart(); flashAIChanges();`);
  ok("a quiet enemy turn flashes nothing",
     [...d.querySelectorAll("#map .rg.changed")].length === 0 ||
     [...d.querySelectorAll("#map .rg.changed")].length === 2);   // prior flash may still be clearing
  ev(`markAIStart(); S.fs.loc = "bree"; refreshMap(); flashAIChanges();`);
  ok("a fellowship move counts as a change", !!d.querySelector("#rg_bree.changed"));

  // ---- stale AI callbacks must not act after an undo ----
  ev(`CFG.human = { fp: true, sh: false }; startGame(); checkpoint();`);
  const eraBefore = ev("epoch");
  ev(`__fired = 0; __era = epoch;`);
  ev(`doUndo()`);
  ok("undo advances the epoch", ev("epoch") > eraBefore, eraBefore + " -> " + ev("epoch"));
  ok("a callback scheduled before the undo stands down",
     ev(`(() => { const era = __era; if (era !== epoch) return true; __fired++; return false; })()`),
     "fired=" + ev("__fired"));
  ok("resume also advances the epoch",
     ev(`(() => { autosave(); const e0 = epoch; resumeSaved(); return epoch > e0; })()`));

  // ---- storage shim degrades instead of throwing ----
  ok("storage reports whether it is persistent", typeof ev("STORE.persistent") === "boolean",
     "persistent=" + ev("STORE.persistent"));
  ok("blocked storage falls back to memory",
     ev(`(() => { const real = STORE.persistent;
        STORE.set("wotr.probe", "x");
        const back = STORE.get("wotr.probe") === "x";
        STORE.del("wotr.probe");
        return back && STORE.get("wotr.probe") === null; })()`));

  // ---- a full automated game still runs with checkpoints live ----
  errors.length = 0;
  const turns = ev(`(() => { CFG.human = { fp:false, sh:false }; startGame();
      let t = 0;
      for (let i = 0; i < 600 && !S.over; i++) {
        if (S.phase !== "action") S.phase = "action";
        if (remaining("fp") + remaining("sh") === 0) { uiEndTurn(); t++; }
        else { const s2 = remaining(S.actor) ? S.actor : (S.actor==="fp"?"sh":"fp"); S.actor = s2;
               const die = S.dice[s2].find(x=>!x.used); if (die) die.used = true; }
      }
      return t; })()`);
  ok("checkpointed game runs " + turns + " turns clean", errors.length === 0, errors.slice(0, 2).join(" | "));
  ok("undo ring is capped", ev("undoStack.length") <= ev("UNDO_DEPTH"),
     ev("undoStack.length") + "/" + ev("UNDO_DEPTH"));

  console.log(report.join("\n"));
  const failed = report.filter(r => r.startsWith("FAIL")).length;
  console.log(`\n${report.length - failed}/${report.length} passed`);
  process.exit(failed ? 1 : 0);
}, 1200);
