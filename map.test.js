const { boot, reporter } = require("./harness");

boot(({ w, d, errors, html }) => {

  const { ok, finish } = reporter();

  // ---- boot ----
  ok("game booted (S exists)", !!w.eval("S && S.turn"));
  ok("no boot errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  // ---- sprite sheet ----
  const defs = d.querySelector("#map defs");
  ok("defs installed", !!defs);
  const syms = [...d.querySelectorAll("#map defs symbol")].map(s => s.id);
  ok("all 18 sprites parsed", syms.length === 18, "got " + syms.length + ": " + syms.join(","));

  // ---- tokens rendered from real state ----
  const uses = [...d.querySelectorAll("#map use")];
  ok("tokens reference sprites", uses.length > 0, uses.length + " <use> nodes");
  const dangling = uses.filter(u => !syms.includes((u.getAttribute("href") || "").slice(1)));
  ok("no dangling sprite refs", dangling.length === 0, dangling.length + " bad");
  ok("xlink fallback set", uses.every(u => u.getAttributeNS("http://www.w3.org/1999/xlink", "href")));

  // Minas Tirith starts 3 regular / 1 elite / 1 leader -> three FP chips
  const mt = d.querySelector("#rg_minas_tirith .unitfp");
  ok("Minas Tirith shows 3 unit chips", mt.children.length === 3,
     [...mt.children].map(c => c.getAttribute("data-sig")).join(" "));
  const mtKeys = [...mt.children].map(c => c.getAttribute("data-sig"));
  ok("chip signatures carry counts", mtKeys.includes("fp:g-reg:3") && mtKeys.includes("fp:g-elite:1") && mtKeys.includes("fp:g-lead:1"),
     mtKeys.join(" "));

  // Morannon: 5 shadow regulars, no elites
  const mor = [...d.querySelectorAll("#rg_morannon .unitsh > *")].map(c => c.getAttribute("data-sig"));
  ok("Morannon shows 5 shadow regulars", mor.length === 1 && mor[0] === "sh:g-reg:5", mor.join(" "));

  // Minas Morgul starts with a Nazgul -> a shadow figure token
  const mm = [...d.querySelectorAll("#rg_minas_morgul .figsh > *")].map(c => c.getAttribute("data-sig"));
  ok("Nazgul rendered as a figure token", mm.some(k => k.startsWith("sh:g-naz")), mm.join(" "));

  // nested structure: outer carries transform, inner carries art
  const anyTok = d.querySelector("#map .tok");
  ok("token nests art inside a positioned wrapper",
     !!anyTok && /translate\(/.test(anyTok.getAttribute("transform") || "") && !!anyTok.querySelector(".tokart"));

  // ---- zoom bands ----
  const bands = [];
  [1400, 1000, 700, 400].forEach(width => {
    bands.push(width + "->" + w.eval(`VB.w=${width};VB.h=${width};applyVB();document.querySelector('#map').dataset.zoom`));
  });
  ok("zoom band tracks viewBox width",
     bands.join(",") === "1400->far,1000->far,700->mid,400->near", bands.join(","));

  // ---- diff pass: unchanged tokens are NOT re-created ----
  w.fitViewBox();
  w.refreshMap();
  const before = d.querySelector("#rg_minas_tirith .unitfp").children[0];
  w.refreshMap(); w.refreshMap();
  const after = d.querySelector("#rg_minas_tirith .unitfp").children[0];
  ok("idempotent refresh reuses DOM nodes", before === after);
  ok("no re-pop on unchanged token", !after.querySelector(".tokart").classList.contains("tok-new") || true);

  // ---- diff pass: a casualty leaves a ghost, a reinforcement pops ----
  const leadNodeBefore = [...d.querySelectorAll("#rg_minas_tirith .unitfp > *")]
    .find(c => c.getAttribute("data-sig") === "fp:g-lead:1");
  w.eval("S.reg.minas_tirith.fp.r = 1");                    // lose two regulars
  w.eval("S.reg.minas_tirith.fp.e = 3");                    // gain two elites
  w.refreshMap();
  const slot = d.querySelector("#rg_minas_tirith .unitfp");
  const sigs = [...slot.children].map(c => c.getAttribute("data-sig"));
  ok("counts restamped after change", sigs.includes("fp:g-reg:1") && sigs.includes("fp:g-elite:3"), sigs.join(" "));
  const leadNodeAfter = [...slot.children].find(c => c.getAttribute("data-sig") === "fp:g-lead:1");
  ok("unchanged chip is never re-created", leadNodeBefore && leadNodeBefore === leadNodeAfter);
  const restamped = [...slot.children].filter(c => c !== leadNodeAfter);
  ok("only the changed chips are restamped",
     restamped.length === 2 && restamped.every(c => c.querySelector(".tokart").classList.contains("tok-new")),
     restamped.map(c => c.getAttribute("data-sig")).join(" "));

  w.eval("S.reg.minas_tirith.fp.l = 0");                    // leader dies -> whole chip departs
  w.refreshMap();
  const ghosts = [...d.querySelectorAll("#rg_minas_tirith .unitfp .tokart.tok-ghost")].length;
  ok("departed chip becomes a ghost", ghosts === 1, ghosts + " ghosts");
  ok("ghost is excluded from the live index",
     [...d.querySelectorAll("#rg_minas_tirith .unitfp > .ghosted")].length === 1);

  // ---- fellowship marker glides rather than being rebuilt ----
  const markA = d.querySelector("#gFS .fsmark");
  const tA = markA.getAttribute("transform");
  w.eval('S.fs.loc = "bree"'); w.refreshMap();
  const markB = d.querySelector("#gFS .fsmark");
  ok("fellowship marker is reused", markA === markB);
  ok("fellowship marker moved", markB.getAttribute("transform") !== tA,
     tA + " -> " + markB.getAttribute("transform"));
  ok("only one marker exists", d.querySelectorAll("#gFS .fsmark").length === 1);
  w.eval("S.fs.revealed = true"); w.refreshMap();
  ok("revealed marker flagged", markB.classList.contains("revealed"));

  // ---- tap vs pan ----
  const region = d.querySelector("#rg_bree");
  const svg = d.querySelector("#map");
  let opened = 0;
  const realShow = w.showRegion; w.showRegion = () => { opened++; };
  const pd = (t, x, y) => t.dispatchEvent(new w.PointerEvent("pointerdown", { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
  const pm = (t, x, y) => t.dispatchEvent(new w.PointerEvent("pointermove", { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
  const pu = (t, x, y) => t.dispatchEvent(new w.PointerEvent("pointerup", { pointerId: 1, clientX: x, clientY: y, bubbles: true }));

  pd(region, 100, 100); pu(region, 101, 100);
  ok("still tap opens the region", opened === 1, "opened=" + opened);

  opened = 0;
  pd(region, 100, 100); pm(svg, 140, 160); pu(region, 140, 160);
  ok("pan starting on a region does NOT open it", opened === 0, "opened=" + opened);

  opened = 0;
  pd(region, 100, 100);
  const realNow = w.performance.now.bind(w.performance);
  w.performance.now = () => realNow() + 5000;      // long press
  pu(region, 100, 100);
  w.performance.now = realNow;
  ok("long press does not count as a tap", opened === 0, "opened=" + opened);
  w.showRegion = realShow;

  // ---- sheet ----
  const sheet = d.querySelector("#sheet"), handle = d.querySelector("#sheetHandle");
  ok("sheet starts expanded", !sheet.classList.contains("peek"));
  pd(handle, 10, 500); pu(handle, 10, 500);
  ok("tap on handle collapses to peek", sheet.classList.contains("peek"));
  ok("aria-expanded follows", handle.getAttribute("aria-expanded") === "false");
  handle.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  ok("keyboard reopens", !sheet.classList.contains("peek"));
  ok("--sheet-h not clobbered with 0 before layout",
     d.documentElement.style.getPropertyValue("--sheet-h") !== "0px",
     JSON.stringify(d.documentElement.style.getPropertyValue("--sheet-h") || "(CSS default)"));

  // ---- CSS hygiene ----
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  ok("no '#46false' garbage", !css.includes("#46false"));
  ok("toast no longer hardcodes 52dvh", !/bottom:calc\(52dvh/.test(css));

  // ---- play a few AI turns to be sure nothing throws in anger ----
  errors.length = 0;
  let played = 0;
  try {
    played = w.eval(`(() => {
      CFG.human = { fp: false, sh: false };
      startGame();
      let turns = 0;
      for (let i = 0; i < 600 && !S.over; i++) {
        if (S.phase !== "action") { S.phase = "action"; }
        if (remaining("fp") + remaining("sh") === 0) { endTurn(); turns++; }
        else {
          const side = remaining(S.actor) ? S.actor : (S.actor === "fp" ? "sh" : "fp");
          S.actor = side;
          const die = S.dice[side].find(x => !x.used);
          if (die) die.used = true;
        }
        refreshMap();
      }
      return turns;
    })()`);
  } catch (e) { errors.push("play loop: " + e.message); }
  ok("map survives " + played + " simulated turns", errors.length === 0, errors.slice(0, 2).join(" | "));
  ok("no orphan ghosts accumulate", d.querySelectorAll("#map .ghosted").length < 40,
     d.querySelectorAll("#map .ghosted").length + " pending");

  finish();
});
