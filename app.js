(() => {
"use strict";
const KEY = "pixel-timer-v1";
const COLORS = ["#d62d27", "#459fdb", "#86bc63", "#e3a53b", "#b0679f"];
const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- state ---------- */
let S;
function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || typeof S !== "object") S = {};
  S.projects = S.projects || [{ id: uid(), name: "メイン案件", rate: 0, color: COLORS[1] }];
  S.entries = S.entries || [];
  S.running = S.running || null;
  S.opts = Object.assign({ sound: true, round: "floor", lastProject: S.projects[0].id }, S.opts || {});
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert("保存に失敗しました"); } }
load();

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const toMin = (ms) => {
  const m = ms / 60000;
  return Math.max(0, S.opts.round === "ceil" ? Math.ceil(m) : S.opts.round === "round" ? Math.round(m) : Math.floor(m));
};
const fmtDur = (min) => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h ${m}m` : `${m}m`; };
const fmtYen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const hm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toLocalInput = (t) => { const d = new Date(t); return `${dayKey(t)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const proj = (id) => S.projects.find((p) => p.id === id) || { name: "(削除済み)", rate: 0, color: "#777" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const entryMin = (e) => toMin(e.end - e.start);
const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x.getTime(); };

/* all entries including the running one (as of now) */
function allEntries() {
  const list = S.entries.slice();
  if (S.running) list.push({ id: "run", projectId: S.running.projectId, start: S.running.start, end: Date.now(), memo: S.running.memo });
  return list;
}
function sumFor(list) {
  let min = 0, yen = 0;
  for (const e of list) { const m = entryMin(e); min += m; yen += (m / 60) * (proj(e.projectId).rate || 0); }
  return { min, yen };
}

/* ---------- sound ---------- */
let actx;
function beep(seq) {
  if (!S.opts.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    let t = actx.currentTime;
    for (const f of seq) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.1); t += 0.09;
    }
  } catch (e) {}
}

/* ---------- tabs ---------- */
function showView(v) {
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === "view-" + v));
  document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("active", el.dataset.view === v));
  if (v === "log") renderLog();
  if (v === "sum") renderSum();
  if (v === "set") renderSettings();
  if (v === "timer") renderTimer();
  $("main").scrollTop = 0;
}
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));

/* ---------- timer view ---------- */
function renderProjectSelect() {
  const sel = $("#projectSelect");
  const cur = S.running ? S.running.projectId : S.opts.lastProject;
  sel.innerHTML = S.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  sel.value = S.projects.some((p) => p.id === cur) ? cur : S.projects[0].id;
  sel.disabled = !!S.running;
}
function renderTimer() {
  const btn = $("#toggleBtn"), clock = $("#clock");
  if (S.running) {
    const ms = Date.now() - S.running.start;
    const m = Math.floor(ms / 60000), sec = Math.floor(ms / 1000) % 60;
    clock.innerHTML = `${pad(Math.floor(m / 60))}<span class="colon">:</span>${pad(m % 60)}<span class="colon">:</span>${pad(sec)}`;
    clock.className = "clock run";
    $("#clockSub").textContent = `${hm(S.running.start)} ～ 作業中 / ${proj(S.running.projectId).name}`;
    btn.textContent = "■ STOP"; btn.className = "px-btn big stop";
    setStack(Math.floor(m / 10));
  } else {
    clock.textContent = "00:00:00"; clock.className = "clock idle";
    $("#clockSub").textContent = "READY";
    btn.textContent = "▶ START"; btn.className = "px-btn big start";
    setStack(0);
  }
  const now = Date.now(), all = allEntries();
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const m0 = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
  const w0 = startOfWeek(now);
  const inRange = (from) => all.filter((e) => e.start >= from);
  $("#sToday").textContent = fmtDur(sumFor(inRange(d0.getTime())).min);
  $("#sWeek").textContent = fmtDur(sumFor(inRange(w0)).min);
  const mo = sumFor(inRange(m0));
  $("#sMonth").textContent = fmtDur(mo.min);
  $("#sYen").textContent = fmtYen(mo.yen);
}
function setStack(n10) {
  // 10分ごとに1ブロック。12ブロック(2時間)で一周
  const on = n10 === 0 ? 0 : ((n10 - 1) % 12) + 1;
  const st = $("#stack");
  if (st.dataset.on === String(on) && st.childElementCount) return;
  st.dataset.on = on;
  st.innerHTML = Array.from({ length: 12 }, (_, i) => i < on ? `<i class="on" style="background:${COLORS[i % 5]}"></i>` : "<i></i>").join("");
}
function toggle() {
  if (S.running) {
    const end = Date.now();
    if (end - S.running.start >= 1000) {
      S.entries.push({ id: uid(), projectId: S.running.projectId, start: S.running.start, end, memo: S.running.memo || "" });
    }
    S.running = null; $("#memoInput").value = "";
    beep([660, 440, 330]);
  } else {
    S.opts.lastProject = $("#projectSelect").value;
    S.running = { projectId: S.opts.lastProject, start: Date.now(), memo: $("#memoInput").value.trim() };
    beep([440, 660, 880]);
  }
  save(); renderProjectSelect(); renderTimer();
}
$("#toggleBtn").addEventListener("click", toggle);
$("#projectSelect").addEventListener("change", (e) => { S.opts.lastProject = e.target.value; save(); });
$("#memoInput").addEventListener("input", (e) => { if (S.running) { S.running.memo = e.target.value.trim(); save(); } });

/* ---------- modal ---------- */
function openModal(title, bodyHtml, buttons) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = bodyHtml;
  const box = $("#modalBtns"); box.innerHTML = "";
  buttons.forEach((b) => {
    const el = document.createElement("button");
    el.className = "px-btn small " + (b.cls || ""); el.textContent = b.label;
    el.addEventListener("click", () => { if (b.fn() !== false) closeModal(); });
    box.appendChild(el);
  });
  $("#modal").hidden = false;
}
function closeModal() { $("#modal").hidden = true; }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

/* ---------- log ---------- */
function renderLog() {
  const list = $("#logList");
  const es = S.entries.slice().sort((a, b) => b.start - a.start);
  if (!es.length && !S.running) { list.innerHTML = `<div class="empty">まだ記録がありません</div>`; return; }
  let html = "", cur = "", bucket = [];
  const flush = () => {
    if (!bucket.length) return;
    const t = sumFor(bucket).min;
    html += `<div class="day-h"><span>${cur.replace(/-/g, "/")}</span><span>${fmtDur(t)}</span></div>`;
    for (const e of bucket) {
      const p = proj(e.projectId);
      html += `<div class="item" data-id="${e.id}"><div class="l"><span class="chip" style="background:${p.color}"></span><div class="t"><div class="t1">${esc(p.name)}${e.memo ? " / " + esc(e.memo) : ""}</div><div class="t2">${hm(e.start)} - ${hm(e.end)}</div></div></div><div class="r">${fmtDur(entryMin(e))}</div></div>`;
    }
    bucket = [];
  };
  for (const e of es) { const k = dayKey(e.start); if (k !== cur) { flush(); cur = k; } bucket.push(e); }
  flush();
  list.innerHTML = html;
  list.querySelectorAll(".item").forEach((el) => el.addEventListener("click", () => editEntry(el.dataset.id)));
}
function entryForm(e) {
  return `<div class="fld"><label class="lbl">PROJECT</label><select id="fP" class="px-input">${S.projects.map((p) => `<option value="${p.id}" ${p.id === e.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
  <div class="fld"><label class="lbl">START</label><input id="fS" type="datetime-local" class="px-input" value="${toLocalInput(e.start)}"></div>
  <div class="fld"><label class="lbl">END</label><input id="fE" type="datetime-local" class="px-input" value="${toLocalInput(e.end)}"></div>
  <div class="fld"><label class="lbl">MEMO</label><input id="fM" type="text" class="px-input" maxlength="60" value="${esc(e.memo || "")}"></div>`;
}
function readEntryForm() {
  const s = new Date($("#fS").value).getTime(), en = new Date($("#fE").value).getTime();
  if (!isFinite(s) || !isFinite(en) || en <= s) { alert("開始・終了時刻を正しく入力してください(終了は開始より後)"); return null; }
  return { projectId: $("#fP").value, start: s, end: en, memo: $("#fM").value.trim() };
}
function editEntry(id) {
  const e = S.entries.find((x) => x.id === id); if (!e) return;
  openModal("記録を編集", entryForm(e), [
    { label: "保存", fn: () => { const v = readEntryForm(); if (!v) return false; Object.assign(e, v); save(); renderLog(); } },
    { label: "削除", cls: "danger", fn: () => { if (!confirm("この記録を削除しますか?")) return false; S.entries = S.entries.filter((x) => x.id !== id); save(); renderLog(); } },
    { label: "閉じる", cls: "ghost", fn: () => {} },
  ]);
}
$("#addManualBtn").addEventListener("click", () => {
  const now = Date.now();
  openModal("手動で追加", entryForm({ projectId: S.opts.lastProject, start: now - 3600000, end: now, memo: "" }), [
    { label: "追加", fn: () => { const v = readEntryForm(); if (!v) return false; S.entries.push({ id: uid(), ...v }); save(); renderLog(); } },
    { label: "閉じる", cls: "ghost", fn: () => {} },
  ]);
});

/* ---------- summary ---------- */
let sumY, sumM;
(() => { const d = new Date(); sumY = d.getFullYear(); sumM = d.getMonth(); })();
function renderSum() {
  $("#sumTitle").textContent = `${sumY}/${pad(sumM + 1)}`;
  const from = new Date(sumY, sumM, 1).getTime(), to = new Date(sumY, sumM + 1, 1).getTime();
  const list = allEntries().filter((e) => e.start >= from && e.start < to);
  const tot = sumFor(list);
  $("#mTotal").textContent = fmtDur(tot.min); $("#mYen").textContent = fmtYen(tot.yen);
  const by = {};
  list.forEach((e) => { (by[e.projectId] = by[e.projectId] || []).push(e); });
  const rows = Object.entries(by).map(([id, es]) => ({ id, ...sumFor(es) })).sort((a, b) => b.min - a.min);
  $("#sumByProject").innerHTML = rows.length ? rows.map((r) => {
    const p = proj(r.id);
    return `<div class="item"><div class="l"><span class="chip" style="background:${p.color}"></span><div class="t"><div class="t1">${esc(p.name)}</div><div class="t2">${p.rate ? "¥" + p.rate.toLocaleString("ja-JP") + "/h" : "時給未設定"}</div></div></div><div class="r" style="text-align:right">${fmtDur(r.min)}<div class="t2">${fmtYen(r.yen)}</div></div></div>`;
  }).join("") : `<div class="empty">この月の記録はありません</div>`;
  const days = new Date(sumY, sumM + 1, 0).getDate(), arr = Array(days).fill(0);
  list.forEach((e) => { arr[new Date(e.start).getDate() - 1] += entryMin(e); });
  const mx = Math.max(60, ...arr);
  $("#sumByDay").innerHTML = arr.map((v, i) => `<div class="bar" title="${i + 1}日 ${fmtDur(v)}" style="height:${(v / mx) * 100}%;background:${COLORS[i % 5]}"></div>`).join("");
}
$("#prevMonth").addEventListener("click", () => { sumM--; if (sumM < 0) { sumM = 11; sumY--; } renderSum(); });
$("#nextMonth").addEventListener("click", () => { sumM++; if (sumM > 11) { sumM = 0; sumY++; } renderSum(); });

/* ---------- settings ---------- */
function renderSettings() {
  $("#projectList").innerHTML = S.projects.map((p) => `<div class="item" data-id="${p.id}"><div class="l"><span class="chip" style="background:${p.color}"></span><div class="t"><div class="t1">${esc(p.name)}</div><div class="t2">${p.rate ? "¥" + p.rate.toLocaleString("ja-JP") + "/h" : "時給未設定"}</div></div></div><div class="r">✎</div></div>`).join("");
  $("#projectList").querySelectorAll(".item").forEach((el) => el.addEventListener("click", () => editProject(el.dataset.id)));
  try {
    const t = document.createElement("div");
    t.style.cssText = "position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px);padding-top:env(safe-area-inset-top,0px)";
    document.body.appendChild(t);
    const cs = getComputedStyle(t);
    $("#debugInfo").textContent = `win ${innerWidth}x${innerHeight} / screen ${screen.width}x${screen.height} / safe top ${cs.paddingTop} bottom ${cs.paddingBottom} / standalone ${navigator.standalone === true}`;
    t.remove();
  } catch (e) {}
  $("#optSound").checked = S.opts.sound;
  $("#optRound").value = S.opts.round;
}
function editProject(id) {
  const p = id ? S.projects.find((x) => x.id === id) : { name: "", rate: 0, color: COLORS[S.projects.length % 5] };
  let color = p.color;
  openModal(id ? "案件を編集" : "案件を追加",
    `<div class="fld"><label class="lbl">NAME</label><input id="pN" class="px-input" maxlength="30" value="${esc(p.name)}"></div>
     <div class="fld"><label class="lbl">時給 (円・任意)</label><input id="pR" type="number" inputmode="numeric" min="0" class="px-input" value="${p.rate || ""}"></div>
     <label class="lbl">COLOR</label><div class="color-pick" id="pC">${COLORS.map((c) => `<button data-c="${c}" style="background:${c}" class="${c === color ? "sel" : ""}"></button>`).join("")}</div>`,
    [
      { label: "保存", fn: () => {
        const name = $("#pN").value.trim(); if (!name) { alert("名前を入力してください"); return false; }
        const rate = Math.max(0, parseInt($("#pR").value, 10) || 0);
        if (id) Object.assign(p, { name, rate, color }); else S.projects.push({ id: uid(), name, rate, color });
        save(); renderSettings(); renderProjectSelect();
      } },
      ...(id ? [{ label: "削除", cls: "danger", fn: () => {
        if (S.projects.length <= 1) { alert("案件は最低1つ必要です"); return false; }
        if (S.running && S.running.projectId === id) { alert("作業中の案件は削除できません"); return false; }
        if (!confirm("案件を削除しますか?(過去の記録は残ります)")) return false;
        S.projects = S.projects.filter((x) => x.id !== id);
        if (S.opts.lastProject === id) S.opts.lastProject = S.projects[0].id;
        save(); renderSettings(); renderProjectSelect();
      } }] : []),
      { label: "閉じる", cls: "ghost", fn: () => {} },
    ]);
  $("#pC").addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    color = b.dataset.c; $("#pC").querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b));
  });
}
$("#addProjectBtn").addEventListener("click", () => editProject(null));
$("#optSound").addEventListener("change", (e) => { S.opts.sound = e.target.checked; save(); if (e.target.checked) beep([660, 880]); });
$("#optRound").addEventListener("change", (e) => { S.opts.round = e.target.value; save(); });

/* ---------- backup ---------- */
function download(name, text, type) {
  const blob = new Blob([text], { type }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
$("#exportJson").addEventListener("click", () => download(`pixel-timer-${dayKey(Date.now())}.json`, JSON.stringify(S, null, 1), "application/json"));
$("#exportCsv").addEventListener("click", () => {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [["日付", "開始", "終了", "分", "案件", "時給", "金額", "メモ"].join(",")];
  S.entries.slice().sort((a, b) => a.start - b.start).forEach((e) => {
    const p = proj(e.projectId), m = entryMin(e);
    rows.push([dayKey(e.start), hm(e.start), hm(e.end), m, q(p.name), p.rate || 0, Math.round((m / 60) * (p.rate || 0)), q(e.memo || "")].join(","));
  });
  download(`pixel-timer-${dayKey(Date.now())}.csv`, "﻿" + rows.join("\n"), "text/csv");
});
$("#importJson").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.projects) || !Array.isArray(d.entries)) throw 0;
      if (!confirm("現在のデータを上書きして読み込みますか?")) return;
      localStorage.setItem(KEY, JSON.stringify(d)); load(); renderProjectSelect(); showView("timer");
    } catch (e) { alert("読み込めないファイルです"); }
  };
  r.readAsText(f); ev.target.value = "";
});
$("#resetBtn").addEventListener("click", () => {
  if (!confirm("全てのデータを削除します。よろしいですか?")) return;
  if (!confirm("本当に削除しますか?(元に戻せません)")) return;
  localStorage.removeItem(KEY); load(); renderProjectSelect(); showView("timer");
});

/* ---------- boot ---------- */
renderProjectSelect(); renderTimer();
if (S.running) $("#memoInput").value = S.running.memo || "";
setInterval(() => { if (document.getElementById("view-timer").classList.contains("active")) renderTimer(); }, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderTimer(); });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
