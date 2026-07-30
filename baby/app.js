/* ==========================================================================
 * app.js — 乳幼児の栄養・食事・成長記録アプリ本体
 * 依存ライブラリなし。データは localStorage に保存（端末内で完結／外部送信なし）。
 *
 * 主な機能
 *   - 食事記録と栄養の過不足（1〜2歳の食事摂取基準と比較）
 *   - 成長記録（身長・体重・成長曲線・カウプ指数）
 *   - 初めて食べた食材とアレルギー記録
 *   - 生活リズム（ミルク・水分・睡眠・排便）
 *   - フードロスを増やさない献立提案（在庫の期限順に使い切る）
 * ======================================================================== */
(function () {
  "use strict";

  const {
    DRI, driKeyForMonths, FOODS, ALLERGENS, RECIPES,
    GROWTH, KAUP_BANDS, STAGES, SHELF_LIFE,
  } = window.BABY_DATA;

  const STORE_KEY = "babyApp.v1";
  const MEAL_SLOTS = [
    { key: "breakfast", label: "朝食", icon: "🌅" },
    { key: "lunch", label: "昼食", icon: "🌞" },
    { key: "dinner", label: "夕食", icon: "🌙" },
    { key: "snack", label: "おやつ", icon: "🍎" },
  ];
  const PLACES = { fridge: "冷蔵", freezer: "冷凍", pantry: "常温" };

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const fmt = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("ja-JP");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 日付は必ず端末のローカル時刻で扱う（UTC基準にすると日本では深夜〜朝9時が前日扱いになる）
  const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = () => dstr(new Date());
  const parseDate = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dstr(d); };
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const num = (v, dflt = 0) => { const n = parseFloat(v); return isNaN(n) ? dflt : n; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const foodByName = {};
  FOODS.forEach((f) => (foodByName[f.name] = f));

  // ==========================================================================
  //  状態管理
  // ==========================================================================
  const State = {
    data: null,
    blank() {
      return {
        profile: null,          // { name, birth, sex }
        logs: {},               // 日付 → 記録
        stock: [],              // 食材在庫
        firstFoods: {},         // 食材名 → { date, status, symptom }
        plan: null,             // 直近に生成した献立
        settings: { snackPerDay: 1 },
      };
    },
    load() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (_) { raw = null; }
      this.data = Object.assign(this.blank(), raw || {});
      if (!this.data.logs) this.data.logs = {};
      if (!Array.isArray(this.data.stock)) this.data.stock = [];
      if (!this.data.firstFoods) this.data.firstFoods = {};
      if (!this.data.settings) this.data.settings = { snackPerDay: 1 };
    },
    save() {
      Object.keys(this.data.logs).forEach((k) => {
        if (!dayHasContent(this.data.logs[k])) delete this.data.logs[k];
      });
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
    },
    log(date) {
      if (!this.data.logs[date]) {
        this.data.logs[date] = {
          meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
          milk: { count: 0, ml: 0 }, water: 0,
          sleep: { night: 0, nap: 0 }, poop: { count: 0, memo: "" },
          body: {}, memo: "",
        };
      }
      const l = this.data.logs[date];
      if (!l.meals) l.meals = { breakfast: [], lunch: [], dinner: [], snack: [] };
      MEAL_SLOTS.forEach((s) => { if (!Array.isArray(l.meals[s.key])) l.meals[s.key] = []; });
      if (!l.milk) l.milk = { count: 0, ml: 0 };
      if (!l.sleep) l.sleep = { night: 0, nap: 0 };
      if (!l.poop) l.poop = { count: 0, memo: "" };
      if (!l.body) l.body = {};
      return l;
    },
  };

  function dayHasContent(l) {
    if (!l) return false;
    const anyMeal = MEAL_SLOTS.some((s) => (l.meals && l.meals[s.key] || []).length);
    return !!(anyMeal || (l.milk && (l.milk.ml || l.milk.count)) || l.water ||
      (l.sleep && (l.sleep.night || l.sleep.nap)) || (l.poop && (l.poop.count || l.poop.memo)) ||
      (l.body && (l.body.height || l.body.weight)) || l.memo);
  }

  // ==========================================================================
  //  月齢・発育段階
  // ==========================================================================
  // 生年月日から満月齢を求める（誕生日を過ぎていない月はカウントしない）
  function monthsOld(birth, at) {
    if (!birth) return null;
    const b = parseDate(birth), d = at ? parseDate(at) : new Date();
    let m = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
    if (d.getDate() < b.getDate()) m -= 1;
    return Math.max(0, m);
  }
  function ageLabel(birth, at) {
    const m = monthsOld(birth, at);
    if (m == null) return "—";
    return m < 12 ? `${m}ヶ月` : `${Math.floor(m / 12)}歳${m % 12}ヶ月`;
  }
  function stageOf(months) {
    if (months == null) return null;
    return STAGES.find((s) => months >= s.from && months <= s.to) || STAGES[STAGES.length - 1];
  }
  // 現在の基準値（年齢区分×性別）
  function driFor(months, sex) {
    const key = driKeyForMonths(months == null ? 14 : months);
    const band = DRI[key];
    return Object.assign({ _label: band.label, _fatPct: band.fatPct, _carbPct: band.carbPct },
      band[sex === "male" ? "male" : "female"]);
  }

  // ==========================================================================
  //  栄養計算
  // ==========================================================================
  const NUT_KEYS = ["kcal", "p", "f", "c", "fiber", "ca", "fe", "zn", "vc", "vd", "salt"];

  function nutOfItem(item) {
    const f = foodByName[item.name];
    const out = {}; NUT_KEYS.forEach((k) => (out[k] = 0));
    if (!f) return out;
    const r = num(item.g) / 100;
    NUT_KEYS.forEach((k) => (out[k] = (f.per100[k] || 0) * r));
    return out;
  }
  function sumNut(items) {
    const t = {}; NUT_KEYS.forEach((k) => (t[k] = 0));
    (items || []).forEach((it) => {
      const n = nutOfItem(it);
      NUT_KEYS.forEach((k) => (t[k] += n[k]));
    });
    return t;
  }
  function dayNut(log) {
    const all = MEAL_SLOTS.reduce((acc, s) => acc.concat((log.meals || {})[s.key] || []), []);
    return sumNut(all);
  }

  /* ビタミンAが極端に多い食材（レバー等）からの摂取量を合算する。
     食品DB全体にビタミンA値は持たせていないため、上限判定はこれらの食材に限って行う。 */
  function vitaminAFromHighFoods(log) {
    let total = 0; const names = [];
    MEAL_SLOTS.forEach((s) => (log.meals[s.key] || []).forEach((it) => {
      const f = foodByName[it.name];
      if (f && f.vaHigh) {
        total += f.vaHigh * (num(it.g) / 100);
        if (!names.includes(it.name)) names.push(it.name);
      }
    }));
    return { total, names };
  }

  // 過不足の判定 — 上限系(salt)は超えたら悪い、それ以外は不足が悪い
  function nutStatus(key, val, goal) {
    if (!goal) return { tone: "info", pct: 0 };
    const pct = (val / goal) * 100;
    if (key === "salt") {
      if (pct > 100) return { tone: "bad", pct };
      if (pct > 80) return { tone: "warn", pct };
      return { tone: "good", pct };
    }
    if (pct < 60) return { tone: "bad", pct };
    if (pct < 85) return { tone: "warn", pct };
    if (pct > 150) return { tone: "warn", pct };
    return { tone: "good", pct };
  }

  const NUT_META = [
    { key: "kcal", label: "エネルギー", unit: "kcal", goal: "kcal", d: 0 },
    { key: "p", label: "たんぱく質", unit: "g", goal: "protein", d: 1 },
    { key: "fe", label: "鉄", unit: "mg", goal: "fe", d: 1 },
    { key: "ca", label: "カルシウム", unit: "mg", goal: "ca", d: 0 },
    { key: "zn", label: "亜鉛", unit: "mg", goal: "zn", d: 1 },
    { key: "vc", label: "ビタミンC", unit: "mg", goal: "vc", d: 0 },
    { key: "vd", label: "ビタミンD", unit: "µg", goal: "vd", d: 1 },
    { key: "fiber", label: "食物繊維", unit: "g", goal: "fiber", d: 1 },
    { key: "salt", label: "食塩相当量", unit: "g", goal: "salt", d: 1 },
  ];

  // ==========================================================================
  //  成長（パーセンタイル・カウプ指数）
  // ==========================================================================
  // 月齢に対する [P3,P50,P97] をアンカー間の線形補間で求める
  function refAt(sex, kind, months) {
    const g = GROWTH[sex === "male" ? "male" : "female"][kind];
    const ms = GROWTH.months;
    if (months <= ms[0]) return g[0].slice();
    if (months >= ms[ms.length - 1]) return g[g.length - 1].slice();
    let i = 0;
    while (i < ms.length - 1 && ms[i + 1] < months) i++;
    const t = (months - ms[i]) / (ms[i + 1] - ms[i]);
    return g[i].map((v, j) => v + (g[i + 1][j] - v) * t);
  }
  // P3/P50/P97 を折れ線として、実測値のおおよそのパーセンタイルを返す
  function percentileOf(sex, kind, months, value) {
    const [p3, p50, p97] = refAt(sex, kind, months);
    if (value <= p3) return Math.max(0.5, 3 - (p3 - value) / Math.max(0.01, p3 * 0.05));
    if (value >= p97) return Math.min(99.5, 97 + (value - p97) / Math.max(0.01, p97 * 0.05));
    if (value < p50) return 3 + ((value - p3) / (p50 - p3)) * 47;
    return 50 + ((value - p50) / (p97 - p50)) * 47;
  }
  function kaup(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    return weightKg / Math.pow(heightCm / 100, 2);
  }
  function kaupJudge(k, months) {
    if (k == null) return null;
    const b = KAUP_BANDS.find((x) => months <= x.toMonth) || KAUP_BANDS[KAUP_BANDS.length - 1];
    if (k < b.thin) return { label: "やせすぎ", tone: "bad" };
    if (k < b.lean) return { label: "やせぎみ", tone: "warn" };
    if (k < b.fat) return { label: "ふつう", tone: "good" };
    if (k < b.obese) return { label: "太りぎみ", tone: "warn" };
    return { label: "太りすぎ", tone: "bad" };
  }
  // 身体計測の記録を日付順に返す
  function bodySeries() {
    const p = State.data.profile;
    return Object.keys(State.data.logs).sort()
      .map((d) => ({ date: d, b: State.data.logs[d].body || {} }))
      .filter((x) => x.b.height || x.b.weight)
      .map((x) => ({
        date: x.date, months: monthsOld(p && p.birth, x.date),
        height: x.b.height || null, weight: x.b.weight || null,
      }));
  }
  function latestBody() {
    const s = bodySeries();
    const out = { height: null, weight: null, date: null };
    for (const r of s) {
      if (r.height) { out.height = r.height; out.date = r.date; }
      if (r.weight) { out.weight = r.weight; out.date = r.date; }
    }
    return out;
  }

  // ==========================================================================
  //  在庫（フードロス対策の土台）
  // ==========================================================================
  function stockExpire(s) {
    if (s.exp) return s.exp;
    return addDays(s.buy || todayStr(), SHELF_LIFE[s.place] || 5);
  }
  // 期限までの残り日数（マイナスは期限切れ）
  function daysLeft(s) { return daysBetween(todayStr(), stockExpire(s)); }
  // 1歳児の1食目安量から「あと何食分あるか」を出す（少量しか食べないので余りやすい）
  function servingsLeft(s) {
    const f = foodByName[s.name];
    if (!f || !f.serv) return null;
    return s.g / f.serv;
  }
  function stockSorted() {
    return State.data.stock.slice().sort((a, b) => daysLeft(a) - daysLeft(b));
  }

  // ==========================================================================
  //  献立生成 — フードロスを増やさないことを最優先に組む
  // ==========================================================================
  // 期限が近い食材ほど高い重みを返す
  function urgency(d) {
    if (d <= 0) return 3.2;
    if (d <= 1) return 2.6;
    if (d <= 2) return 2.0;
    if (d <= 3) return 1.6;
    if (d <= 5) return 1.2;
    if (d <= 8) return 0.9;
    return 0.5;
  }

  /* 在庫を集計して { 食材名: { g, days } } にする */
  function stockIndex() {
    const idx = {};
    State.data.stock.forEach((s) => {
      const d = daysLeft(s);
      if (!idx[s.name]) idx[s.name] = { g: 0, days: d };
      idx[s.name].g += num(s.g);
      idx[s.name].days = Math.min(idx[s.name].days, d);
    });
    return idx;
  }

  /* レシピの点数 — 在庫消費量×緊急度を足し、買い足し量と「飽き」を引く */
  function scoreRecipe(r, rem, ctx) {
    let score = 0, useG = 0, missG = 0;
    r.ings.forEach(([name, g]) => {
      const st = rem[name];
      const have = st ? Math.min(st.g, g) : 0;
      if (have > 0) { score += have * urgency(st.days); useG += have; }
      const miss = g - have;
      if (miss > 0) {
        missG += miss;
        // 主食・調味料は常備しているものとして買い足しペナルティを軽くする
        const f = foodByName[name];
        const light = f && (f.cat === "調味料" || f.cat === "主食" || f.cat === "飲みもの");
        score -= miss * (light ? 0.15 : 0.6);
      }
    });
    if (r.share) score += 10;   // 大人の料理から取り分け → 買い足しが要らない
    if (r.frz) score += 5;      // 多めに作って冷凍 → 使い切りやすい

    // 同じ日に同じ料理は出さない（朝昼夕で同じものが並ぶのを防ぐ）
    if (ctx.usedToday.has(r.name)) return { score: -Infinity, useG, missG };

    // 直近に出したものほど強く避ける（直前 -120 → 8品前 -15 まで減衰）
    const ri = ctx.recent.lastIndexOf(r.name);
    if (ri >= 0) {
      const age = ctx.recent.length - ri;            // 1 = 直前に出した
      score -= Math.max(0, 120 - (age - 1) * 15);
    }

    // 摂取回数の上限があるもの（レバー等）は週あたりの回数を守る
    if (r.maxPerWeek) {
      const used = ctx.countByName[r.name] || 0;
      const allowed = Math.max(1, Math.ceil((ctx.days / 7) * r.maxPerWeek));
      if (used >= allowed) return { score: -Infinity, useG, missG };
    }

    // 朝は手間のかかる料理を避ける
    if (ctx.slot === "breakfast" && r.time > 10) score -= (r.time - 10) * 4;

    return { score, useG, missG };
  }

  /* レシピ分の在庫を減らし、実際に使えた量と足りない量を返す */
  function consume(r, rem) {
    let used = 0; const miss = {};
    r.ings.forEach(([name, g]) => {
      const st = rem[name];
      const have = st ? Math.min(st.g, g) : 0;
      if (st) { st.g -= have; if (st.g <= 0.01) delete rem[name]; }
      used += have;
      if (g - have > 0) miss[name] = (miss[name] || 0) + (g - have);
    });
    return { used, miss };
  }

  /* 献立を days 日ぶん生成する */
  function generatePlan(days) {
    const months = monthsOld(State.data.profile && State.data.profile.birth) || 14;
    const usable = RECIPES.filter((r) => r.min <= months);
    const rem = stockIndex();
    const initialG = Object.values(rem).reduce((a, s) => a + s.g, 0);

    const shopping = {};
    let usedG = 0;
    const snackPerDay = clamp(num(State.data.settings.snackPerDay, 1), 0, 2);
    const out = [];
    // 選定の文脈。usedToday は日ごとにリセット、recent と countByName は通算で持つ
    const ctx = { recent: [], usedToday: new Set(), countByName: {}, days, slot: null };

    const pick = (kind) => {
      const cands = usable.filter((r) => r.kind === kind);
      if (!cands.length) return null;
      let best = null, bestS = -Infinity;
      cands.forEach((r) => {
        const info = scoreRecipe(r, rem, ctx);
        if (info.score > bestS) { bestS = info.score; best = r; }
      });
      if (!best || bestS === -Infinity) return null;   // 出せる候補が無い枠は空けておく
      const res = consume(best, rem);
      usedG += res.used;
      Object.entries(res.miss).forEach(([n, g]) => (shopping[n] = (shopping[n] || 0) + g));
      ctx.recent.push(best.name);
      if (ctx.recent.length > 10) ctx.recent.shift();
      ctx.usedToday.add(best.name);
      ctx.countByName[best.name] = (ctx.countByName[best.name] || 0) + 1;
      return best;
    };

    for (let d = 0; d < days; d++) {
      const date = addDays(todayStr(), d);
      const slots = [];
      ctx.usedToday = new Set();
      // 朝は簡単に（主食＋主菜）、昼と夜は主食＋主菜＋副菜
      [["breakfast", ["staple", "main"]],
       ["lunch", ["staple", "main", "side"]],
       ["dinner", ["staple", "main", "side", "soup"]]].forEach(([slot, kinds]) => {
        ctx.slot = slot;
        const dishes = kinds.map(pick).filter(Boolean);
        slots.push({ slot, dishes });
      });
      if (snackPerDay >= 1) {
        ctx.slot = "snack";
        const dishes = [];
        for (let i = 0; i < snackPerDay; i++) { const r = pick("snack"); if (r) dishes.push(r); }
        slots.push({ slot: "snack", dishes });
      }
      out.push({ date, slots });
    }

    // 使い切れずに残った在庫
    const leftover = Object.entries(rem).map(([name, s]) => ({ name, g: s.g, days: s.days }))
      .sort((a, b) => a.days - b.days);

    return {
      generatedAt: Date.now(), days,
      plan: out,
      usedG, initialG,
      useRate: initialG > 0 ? (usedG / initialG) * 100 : 0,
      shopping: Object.entries(shopping).map(([name, g]) => ({ name, g })).sort((a, b) => b.g - a.g),
      leftover,
    };
  }

  /* 残った在庫の使い切り提案 */
  function leftoverAdvice(leftover) {
    const tips = [];
    leftover.slice(0, 6).forEach((l) => {
      const f = foodByName[l.name];
      const sv = f && f.serv ? l.g / f.serv : null;
      if (l.days <= 1) {
        tips.push(`${l.name}（残${fmt(l.g)}g・期限${l.days <= 0 ? "切れ" : "明日"}）は今日中に加熱して小分け冷凍を。`);
      } else if (f && f.frz) {
        tips.push(`${l.name}（残${fmt(l.g)}g${sv ? "・約" + fmt(sv, 1) + "食分" : ""}）は下ゆでして製氷皿で冷凍すると使い切れます。`);
      } else {
        tips.push(`${l.name}（残${fmt(l.g)}g${sv ? "・約" + fmt(sv, 1) + "食分" : ""}）は冷凍に向かないので、大人の料理に回すのが確実です。`);
      }
    });
    return tips;
  }

  // ==========================================================================
  //  ナビゲーション
  // ==========================================================================
  const Nav = {
    tabs: [
      { key: "home", label: "ホーム", icon: "📊" },
      { key: "record", label: "記録", icon: "✍️" },
      { key: "growth", label: "成長", icon: "📈" },
      { key: "menu", label: "献立", icon: "🍳" },
      { key: "foods", label: "食材", icon: "🥕" },
      { key: "profile", label: "プロフィール", icon: "👶" },
      { key: "settings", label: "設定", icon: "⚙️" },
    ],
    current: "home",
    go(key) { this.current = key; render(); window.scrollTo(0, 0); },
  };

  let viewDate = todayStr();     // 記録・ホームで見ている日付
  let growthKind = "weight";     // 成長グラフの表示種別
  let planDays = 3;              // 献立の生成日数

  function render() {
    const app = $("#app");
    const p = State.data.profile;
    if (!p) Nav.current = "profile";
    app.innerHTML = `
      <header class="topbar">
        <div class="brand">👶 <span>ベビー・ヘルスケア</span></div>
        <div class="tb-right">
          <div class="today">${new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</div>
          ${p ? `<div class="agechip">${esc(p.name)} ${ageLabel(p.birth)}</div>` : ""}
        </div>
      </header>
      <nav class="tabs">
        ${Nav.tabs.map((t) => `<button class="tab ${Nav.current === t.key ? "active" : ""}" data-tab="${t.key}">
           <span class="ti">${t.icon}</span><span class="tl">${t.label}</span></button>`).join("")}
      </nav>
      <main id="view"></main>`;
    $$(".tab").forEach((b) => (b.onclick = () => Nav.go(b.dataset.tab)));
    const view = $("#view");
    if (!p && Nav.current !== "profile") Nav.current = "profile";
    ({
      home: renderHome, record: renderRecord, growth: renderGrowth,
      menu: renderMenu, foods: renderFoods, profile: renderProfile, settings: renderSettings,
    })[Nav.current](view);
  }

  // ==========================================================================
  //  ホーム
  // ==========================================================================
  function renderHome(view) {
    const p = State.data.profile;
    const months = monthsOld(p.birth, viewDate);
    const goals = driFor(months, p.sex);
    const log = State.log(viewDate);
    const nut = dayNut(log);
    const st = stageOf(months);
    const isToday = viewDate === todayStr();

    view.innerHTML = `
      <section class="card">
        <div class="row between wrap">
          <h2>今日の栄養</h2>
          <span class="badge brand">${st ? esc(st.name) : ""}・${esc(goals._label)}の基準</span>
        </div>
        <div class="row wrap" style="margin:10px 0">
          <button class="btn xs" id="d-prev">← 前日</button>
          <input type="date" id="d-pick" value="${viewDate}" style="width:auto">
          <button class="btn xs" id="d-next">翌日 →</button>
          ${isToday ? "" : `<button class="btn xs" id="d-today">今日に戻る</button>`}
        </div>
        ${nutBars(nut, goals)}
        <p class="muted">目盛りの縦線が1日の目標量です。食塩は「超えないこと」が目標なので、
          短いほど良い指標として見てください。</p>
      </section>

      ${renderAdvice(nut, goals, log, months)}

      <section class="card">
        <h3>今日の記録</h3>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-l">食事</div>
            <div class="kpi-v">${MEAL_SLOTS.reduce((a, s) => a + log.meals[s.key].length, 0)}<small>品</small></div>
            <div class="kpi-s">${fmt(nut.kcal)} kcal</div></div>
          <div class="kpi"><div class="kpi-l">ミルク・牛乳</div>
            <div class="kpi-v">${fmt(log.milk.ml)}<small>ml</small></div>
            <div class="kpi-s">${fmt(log.milk.count)}回</div></div>
          <div class="kpi"><div class="kpi-l">水分(その他)</div>
            <div class="kpi-v">${fmt(log.water)}<small>ml</small></div>
            <div class="kpi-s">麦茶・水など</div></div>
          <div class="kpi"><div class="kpi-l">睡眠</div>
            <div class="kpi-v">${fmt(log.sleep.night + log.sleep.nap, 1)}<small>h</small></div>
            <div class="kpi-s">夜${fmt(log.sleep.night, 1)} / 昼${fmt(log.sleep.nap, 1)}</div></div>
          <div class="kpi"><div class="kpi-l">排便</div>
            <div class="kpi-v">${fmt(log.poop.count)}<small>回</small></div>
            <div class="kpi-s">${esc(log.poop.memo) || "—"}</div></div>
        </div>
        <button class="btn primary block" id="go-record">記録する</button>
      </section>

      ${renderExpiring()}
      <p class="disclaimer">※ 栄養値・基準値・成長曲線はいずれも概算の参照値です。体調や発育の判断は
        小児科医・管理栄養士や乳幼児健診にご相談ください。</p>`;

    $("#d-prev").onclick = () => { viewDate = addDays(viewDate, -1); render(); };
    $("#d-next").onclick = () => { viewDate = addDays(viewDate, 1); render(); };
    $("#d-pick").onchange = (e) => { viewDate = e.target.value || todayStr(); render(); };
    if ($("#d-today")) $("#d-today").onclick = () => { viewDate = todayStr(); render(); };
    $("#go-record").onclick = () => Nav.go("record");
  }

  function nutBars(nut, goals) {
    const rows = NUT_META.map((m) => {
      const goal = goals[m.goal];
      if (!goal) return "";
      const val = nut[m.key] || 0;
      const s = nutStatus(m.key, val, goal);
      const w = clamp(s.pct, 0, 100);
      return `<div class="nut-row">
        <div class="nut-l">${m.label}</div>
        <div class="nut-track">
          <div class="nut-fill ${s.tone}" style="width:${w}%"></div>
          <div class="nut-goal" style="left:calc(100% - 1px)"></div>
        </div>
        <div class="nut-v">${fmt(val, m.d)} / ${fmt(goal, m.d)}${m.unit}</div>
      </div>`;
    }).join("");
    return `<div class="nut">${rows}</div>`;
  }

  /* 栄養と生活のアドバイスをルールベースで出す */
  function renderAdvice(nut, goals, log, months) {
    const tips = [];
    const pct = (k, g) => (g ? (nut[k] / g) * 100 : 0);
    const anyMeal = MEAL_SLOTS.some((s) => log.meals[s.key].length);

    if (!anyMeal) {
      tips.push({ i: "📝", t: "まだ食事が記録されていません。まずは1食だけでも入れてみると、過不足が見えてきます。" });
    } else {
      if (pct("kcal", goals.kcal) < 70) tips.push({ i: "🍚", t: `エネルギーが目標の${fmt(pct("kcal", goals.kcal))}%です。1〜2歳は胃が小さいので、3食で足りない分はおやつ（4回目の食事）で補うのが基本です。さつまいもやおにぎりが向きます。` });
      if (pct("kcal", goals.kcal) > 130) tips.push({ i: "⚖️", t: "エネルギーが目標を大きく超えています。1日単位の増減は自然なことなので、数日の平均で見てください。" });
      if (pct("fe", goals.fe) < 70) tips.push({ i: "🩸", t: `鉄が目標の${fmt(pct("fe", goals.fe))}%です。この時期は貯蔵鉄が減って不足しやすい栄養素です。赤身肉・レバー・納豆・小松菜・きな粉を足すと届きやすくなります。` });
      if (pct("ca", goals.ca) < 70) tips.push({ i: "🦴", t: `カルシウムが目標の${fmt(pct("ca", goals.ca))}%です。牛乳・ヨーグルト・豆腐・しらす・小松菜で補えます。` });
      if (goals.salt && pct("salt", goals.salt) > 100) tips.push({ i: "🧂", t: `食塩が目標(${goals.salt}g未満)を超えています。1〜2歳は大人の半分以下が目安です。しらすは湯通し、味噌汁は薄め、加工品（チーズ・ハム・練り物）を減らすと下がります。` });
      if (pct("p", goals.protein) > 200) tips.push({ i: "🍗", t: "たんぱく質がかなり多めです。腎臓に負担がかかるため、肉・魚・卵・乳製品はどれか1品に絞ると整います。" });
      if (pct("vd", goals.vd) < 50) tips.push({ i: "☀️", t: "ビタミンDが少なめです。鮭・しらす・卵と、日中の外遊びで補えます。" });
      const veg = MEAL_SLOTS.reduce((a, s) => a + log.meals[s.key].filter((i) => {
        const f = foodByName[i.name]; return f && (f.cat === "副菜" || f.cat === "果物");
      }).length, 0);
      if (veg === 0) tips.push({ i: "🥕", t: "野菜・果物の記録がありません。にんじんやかぼちゃは甘みがあって食べやすく、冷凍ストックにも向きます。" });

      // レバーなどビタミンAが極端に多い食材は、耐容上限量を超えやすいので個別に警告する
      const va = vitaminAFromHighFoods(log);
      if (goals.vaUL && va.total > goals.vaUL) {
        tips.push({ i: "⚠️", t: `${va.names.join("・")}でビタミンAが約${fmt(va.total)}µgRAEになり、耐容上限量(${goals.vaUL}µgRAE/日)を超えています。レバーは3〜4g・週1〜2回までに抑え、鉄は赤身肉・納豆・小松菜・きな粉から摂るほうが安全です。` });
      }
    }

    if (months >= 12 && log.milk.ml > 600) {
      tips.push({ i: "🥛", t: `牛乳・ミルクが${fmt(log.milk.ml)}mlです。1歳以降は1日300〜400mlが目安で、飲み過ぎると食事が入らず鉄不足の原因になります。` });
    }
    if (log.poop.count === 0 && dayHasContent(log)) {
      tips.push({ i: "💧", t: "排便の記録が0回です。2〜3日出ていなければ、水分と食物繊維（さつまいも・バナナ・オートミール）を増やしてみてください。" });
    }
    const totalSleep = log.sleep.night + log.sleep.nap;
    if (totalSleep > 0 && totalSleep < 10) {
      tips.push({ i: "😴", t: `睡眠が${fmt(totalSleep, 1)}時間です。1〜2歳は昼寝を含めて11〜14時間が目安とされています。` });
    }

    if (!tips.length) tips.push({ i: "✅", t: "大きな偏りは見られません。この調子で数日分ためると、傾向がもっと見えてきます。" });

    return `<section class="card"><h3>アドバイス</h3>
      ${tips.map((t) => `<div class="advice-item"><span class="ai-icon">${t.i}</span><span>${esc(t.t)}</span></div>`).join("")}
    </section>`;
  }

  /* 期限が近い在庫の警告（ホームに出す） */
  function renderExpiring() {
    const soon = stockSorted().filter((s) => daysLeft(s) <= 2);
    if (!soon.length) return "";
    return `<section class="card">
      <h3>⏰ 期限が近い食材</h3>
      <p class="muted">この食材を使う献立を組めば、無駄になりません。</p>
      <ul class="stock">
        ${soon.map((s) => {
          const d = daysLeft(s), sv = servingsLeft(s);
          return `<li class="${d < 0 ? "over" : "soon"}">
            <div class="st-name">${esc(s.name)}
              <small>${fmt(s.g)}g${sv ? " ・約" + fmt(sv, 1) + "食分" : ""} / ${PLACES[s.place] || ""}</small></div>
            <span class="st-days ${d < 0 ? "over" : "soon"}">${d < 0 ? "期限切れ" : d === 0 ? "今日まで" : d + "日"}</span>
            <span></span></li>`;
        }).join("")}
      </ul>
      <button class="btn block" id="go-menu">この食材で献立を作る</button>
    </section>`;
  }

  // ==========================================================================
  //  記録
  // ==========================================================================
  function renderRecord(view) {
    const log = State.log(viewDate);
    const p = State.data.profile;
    const months = monthsOld(p.birth, viewDate);

    view.innerHTML = `
      <section class="card">
        <h2>記録する</h2>
        <div class="row wrap" style="margin:10px 0">
          <button class="btn xs" id="r-prev">← 前日</button>
          <input type="date" id="r-pick" value="${viewDate}" style="width:auto">
          <button class="btn xs" id="r-next">翌日 →</button>
          ${viewDate === todayStr() ? "" : `<button class="btn xs" id="r-today">今日に戻る</button>`}
        </div>
        <div class="meals">
          ${MEAL_SLOTS.map((s) => {
            const items = log.meals[s.key];
            const n = sumNut(items);
            return `<div class="meal">
              <div class="meal-head"><span>${s.icon} ${s.label}</span>
                <span class="meal-kcal">${fmt(n.kcal)} kcal</span></div>
              <ul class="items">
                ${items.length ? items.map((it, i) => `<li>
                  <span>${esc(it.name)} <small style="color:var(--muted)">${fmt(it.g)}g</small></span>
                  <button class="x" data-del="${s.key}:${i}">✕</button></li>`).join("")
                  : `<li style="color:var(--muted)">まだありません</li>`}
              </ul>
              <button class="btn sm" data-add="${s.key}">＋ 食材を追加</button>
            </div>`;
          }).join("")}
        </div>
      </section>

      <section class="card">
        <h3>ミルク・水分</h3>
        <div class="form-grid">
          <label>ミルク・牛乳の回数<input type="number" id="milk-c" min="0" step="1" value="${log.milk.count || ""}"></label>
          <label>ミルク・牛乳の量(ml)<input type="number" id="milk-ml" min="0" step="10" value="${log.milk.ml || ""}"></label>
          <label>その他の水分(ml)<input type="number" id="water" min="0" step="10" value="${log.water || ""}"></label>
        </div>
        ${months >= 12 ? `<p class="muted">1歳以降の牛乳は1日300〜400mlが目安です。多すぎると鉄の吸収を妨げ、食事量も落ちます。</p>` : ""}
      </section>

      <section class="card">
        <h3>睡眠・排便</h3>
        <div class="form-grid">
          <label>夜の睡眠(時間)<input type="number" id="sl-n" min="0" max="24" step="0.5" value="${log.sleep.night || ""}"></label>
          <label>昼寝(時間)<input type="number" id="sl-d" min="0" max="12" step="0.5" value="${log.sleep.nap || ""}"></label>
          <label>排便(回)<input type="number" id="poop-c" min="0" step="1" value="${log.poop.count || ""}"></label>
          <label>便のようす<input type="text" id="poop-m" placeholder="ふつう / かたい / ゆるい" value="${esc(log.poop.memo)}"></label>
        </div>
      </section>

      <section class="card">
        <h3>身長・体重</h3>
        <p class="muted">毎日でなくて構いません。月1〜2回でも成長曲線は描けます。</p>
        <div class="form-grid">
          <label>身長(cm)<input type="number" id="b-h" min="30" max="130" step="0.1" value="${log.body.height || ""}"></label>
          <label>体重(kg)<input type="number" id="b-w" min="1" max="40" step="0.01" value="${log.body.weight || ""}"></label>
        </div>
      </section>

      <section class="card">
        <h3>メモ</h3>
        <textarea id="memo" rows="3" placeholder="食べ方のようす、機嫌、湿疹など">${esc(log.memo)}</textarea>
        <button class="btn primary block" id="save">保存する</button>
      </section>`;

    $("#r-prev").onclick = () => { viewDate = addDays(viewDate, -1); render(); };
    $("#r-next").onclick = () => { viewDate = addDays(viewDate, 1); render(); };
    $("#r-pick").onchange = (e) => { viewDate = e.target.value || todayStr(); render(); };
    if ($("#r-today")) $("#r-today").onclick = () => { viewDate = todayStr(); render(); };

    $$("[data-add]").forEach((b) => (b.onclick = () => openFoodPicker(b.dataset.add)));
    $$("[data-del]").forEach((b) => (b.onclick = () => {
      const [slot, i] = b.dataset.del.split(":");
      log.meals[slot].splice(Number(i), 1);
      State.save(); render();
    }));
    $("#save").onclick = () => {
      log.milk.count = num($("#milk-c").value);
      log.milk.ml = num($("#milk-ml").value);
      log.water = num($("#water").value);
      log.sleep.night = num($("#sl-n").value);
      log.sleep.nap = num($("#sl-d").value);
      log.poop.count = num($("#poop-c").value);
      log.poop.memo = $("#poop-m").value.trim();
      const h = num($("#b-h").value), w = num($("#b-w").value);
      log.body.height = h || null; log.body.weight = w || null;
      log.memo = $("#memo").value.trim();
      State.save();
      Nav.go("home");
    };
  }

  /* 食材選択モーダル — 検索して量(g)を決めて追加する */
  function openFoodPicker(slot) {
    const months = monthsOld(State.data.profile.birth) || 14;
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>食材を追加</h3><button class="modal-x">✕</button></div>
        <div class="modal-body">
          <input type="text" id="fp-q" placeholder="食材名で検索（例: にんじん）" autocomplete="off">
          <label class="inline" style="margin-top:10px">
            <input type="checkbox" id="fp-age" checked> 月齢に合うものだけ表示
          </label>
          <div class="fp-list" id="fp-list"></div>
        </div>
      </div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.onclick = (e) => { if (e.target === bg) close(); };
    $(".modal-x", bg).onclick = close;

    const draw = () => {
      const q = $("#fp-q", bg).value.trim();
      const byAge = $("#fp-age", bg).checked;
      const list = FOODS.filter((f) => (!q || f.name.includes(q)) && (!byAge || f.from <= months));
      $("#fp-list", bg).innerHTML = list.length ? list.map((f) => `
        <button class="fp-item" data-name="${esc(f.name)}">
          <span class="fp-name">${esc(f.name)}
            <small>${esc(f.cat)} ・ 1食目安 ${f.serv}g ・ ${f.from}ヶ月から${f.algn ? " ・ " + f.algn.map((a) => ALLERGENS[a] ? ALLERGENS[a].label : a).join("/") : ""}</small></span>
          <span class="fp-k">${fmt(f.per100.kcal * f.serv / 100)}kcal</span>
        </button>`).join("")
        : `<p class="muted">見つかりませんでした。</p>`;
      $$(".fp-item", bg).forEach((b) => (b.onclick = () => pickAmount(b.dataset.name)));
    };
    const pickAmount = (name) => {
      const f = foodByName[name];
      const first = State.data.firstFoods[name];
      $(".modal-body", bg).innerHTML = `
        <h3 style="margin-bottom:4px">${esc(name)}</h3>
        <p class="muted">1歳児の1食目安は ${f.serv}g です。${f.note ? "<br>⚠️ " + esc(f.note) : ""}</p>
        ${!first ? `<div class="warn-box">この食材は「初めて食べた記録」がありません。
          初めての食材は<b>平日の午前中に少量から</b>試すのが安全です。追加すると初回記録に登録されます。</div>` : ""}
        <label class="block">量(g)<input type="number" id="fp-g" value="${f.serv}" min="1" step="1"></label>
        <div class="row wrap" style="margin-top:6px">
          ${[0.5, 1, 1.5, 2].map((r) => `<button class="btn xs" data-r="${r}">${r}食分 (${fmt(f.serv * r)}g)</button>`).join("")}
        </div>
        <button class="btn primary block" id="fp-ok">追加する</button>`;
      $$("[data-r]", bg).forEach((b) => (b.onclick = () => { $("#fp-g", bg).value = Math.round(f.serv * num(b.dataset.r, 1)); }));
      $("#fp-ok", bg).onclick = () => {
        const g = num($("#fp-g", bg).value);
        if (g <= 0) return;
        State.log(viewDate).meals[slot].push({ name, g });
        if (!State.data.firstFoods[name]) {
          State.data.firstFoods[name] = { date: viewDate, status: "trying", symptom: "" };
        }
        // 在庫があれば同量を減らす（使った分を自動で引く）
        deductStock(name, g);
        State.save(); close(); render();
      };
    };
    $("#fp-q", bg).oninput = draw;
    $("#fp-age", bg).onchange = draw;
    draw();
    $("#fp-q", bg).focus();
  }

  /* 記録した分だけ在庫を減らす（期限が近いものから） */
  function deductStock(name, g) {
    let left = g;
    stockSorted().forEach((s) => {
      if (left <= 0 || s.name !== name) return;
      const take = Math.min(s.g, left);
      s.g -= take; left -= take;
    });
    State.data.stock = State.data.stock.filter((s) => s.g > 0.01);
  }

  // ==========================================================================
  //  成長
  // ==========================================================================
  function renderGrowth(view) {
    const p = State.data.profile;
    const months = monthsOld(p.birth);
    const b = latestBody();
    const k = kaup(b.weight, b.height);
    const kj = kaupJudge(k, months);
    const wp = b.weight ? percentileOf(p.sex, "weight", monthsOld(p.birth, b.date), b.weight) : null;
    const hp = b.height ? percentileOf(p.sex, "height", monthsOld(p.birth, b.date), b.height) : null;
    const series = bodySeries();

    view.innerHTML = `
      <section class="card">
        <h2>成長記録</h2>
        ${!series.length ? `<p class="muted">まだ身長・体重の記録がありません。「記録」タブから入力してください。</p>` : `
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-l">身長</div>
            <div class="kpi-v">${b.height ? fmt(b.height, 1) : "—"}<small>cm</small></div>
            <div class="kpi-s">${hp ? "約" + fmt(hp) + "パーセンタイル" : ""}</div></div>
          <div class="kpi"><div class="kpi-l">体重</div>
            <div class="kpi-v">${b.weight ? fmt(b.weight, 2) : "—"}<small>kg</small></div>
            <div class="kpi-s">${wp ? "約" + fmt(wp) + "パーセンタイル" : ""}</div></div>
          <div class="kpi ${kj ? kj.tone : ""}"><div class="kpi-l">カウプ指数</div>
            <div class="kpi-v">${k ? fmt(k, 1) : "—"}</div>
            <div class="kpi-s">${kj ? kj.label : "身長と体重の両方が必要"}</div></div>
          <div class="kpi"><div class="kpi-l">月齢</div>
            <div class="kpi-v">${months}<small>ヶ月</small></div>
            <div class="kpi-s">${esc(b.date || "")}時点</div></div>
        </div>
        ${percentileNote(wp, hp)}`}
      </section>

      ${series.length ? `
      <section class="card">
        <div class="row between wrap">
          <h3>成長曲線</h3>
          <div class="seg">
            <button class="seg-btn ${growthKind === "weight" ? "active" : ""}" data-k="weight">体重</button>
            <button class="seg-btn ${growthKind === "height" ? "active" : ""}" data-k="height">身長</button>
          </div>
        </div>
        <div class="chart-legend">
          <span><i class="line me"></i>${esc(p.name)}</span>
          <span><i class="line p50"></i>中央値(50%)</span>
          <span><i class="line band"></i>3% / 97%</span>
        </div>
        <div class="chart-wrap"><canvas id="gchart" height="260"></canvas></div>
        <p class="muted">帯（3〜97パーセンタイル）の中に入っていて、曲線と同じ向きに伸びているかを見ます。
          一時的に帯から出ることより、<b>カーブから急に外れる変化</b>のほうが大事な情報です。</p>
      </section>

      <section class="card">
        <h3>記録の一覧</h3>
        <div class="scroll-x">
          <table class="tbl">
            <thead><tr><th>日付</th><th>月齢</th><th class="num">身長</th><th class="num">体重</th><th class="num">カウプ</th></tr></thead>
            <tbody>
              ${series.slice().reverse().map((r) => {
                const kk = kaup(r.weight, r.height);
                return `<tr><td>${esc(r.date)}</td><td>${r.months}ヶ月</td>
                  <td class="num">${r.height ? fmt(r.height, 1) : "—"}</td>
                  <td class="num">${r.weight ? fmt(r.weight, 2) : "—"}</td>
                  <td class="num">${kk ? fmt(kk, 1) : "—"}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>` : ""}

      <p class="disclaimer">※ ${esc(GROWTH.note)}
        カウプ指数の判定帯も一般的な目安であり、体格の個人差は大きいものです。</p>`;

    $$("[data-k]").forEach((b2) => (b2.onclick = () => { growthKind = b2.dataset.k; render(); }));
    if (series.length) drawGrowth();
  }

  function percentileNote(wp, hp) {
    const out = [];
    if (wp != null && (wp < 3 || wp > 97)) {
      out.push(`体重が3〜97パーセンタイルの帯から外れています。1回の測定だけで判断せず、次の健診で相談してみてください。`);
    }
    if (hp != null && (hp < 3 || hp > 97)) {
      out.push(`身長が3〜97パーセンタイルの帯から外れています。同じく健診で確認するのが安心です。`);
    }
    if (!out.length) return `<div class="good-box">身長・体重はどちらも標準的な範囲（3〜97パーセンタイル）に入っています。</div>`;
    return `<div class="warn-box">${out.map(esc).join("<br>")}</div>`;
  }

  /* 成長曲線を描く（依存なしのCanvas描画） */
  function drawGrowth() {
    const cv = $("#gchart");
    if (!cv) return;
    const p = State.data.profile;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = 260;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    const css = getComputedStyle(document.body);
    const inkC = css.color || "#222";
    const lineC = "rgba(128,128,128,.35)";
    const pad = { l: 40, r: 10, t: 12, b: 26 };
    const series = bodySeries().filter((r) => r[growthKind]);

    // X軸は 0〜36ヶ月、または記録の最大月齢まで
    const maxM = Math.max(24, Math.min(36, (series.length ? Math.max(...series.map((r) => r.months)) : 12) + 6));
    const ref = [];
    for (let m = 0; m <= maxM; m++) ref.push(refAt(p.sex, growthKind, m));
    const lo = Math.min(...ref.map((r) => r[0])) * 0.95;
    const hi = Math.max(...ref.map((r) => r[2])) * 1.03;

    const X = (m) => pad.l + (m / maxM) * (W - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

    // 目盛り
    g.strokeStyle = lineC; g.lineWidth = 1;
    g.fillStyle = "rgba(128,128,128,.9)"; g.font = "10px -apple-system,sans-serif";
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = lo + ((hi - lo) * i) / ticks;
      const y = Y(v);
      g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
      g.textAlign = "right"; g.textBaseline = "middle";
      g.fillText(fmt(v, growthKind === "weight" ? 1 : 0), pad.l - 5, y);
    }
    g.textAlign = "center"; g.textBaseline = "top";
    for (let m = 0; m <= maxM; m += 6) g.fillText(`${m}ヶ月`, X(m), H - pad.b + 6);

    // 参照曲線（3% / 50% / 97%）
    const drawRef = (idx, style, width) => {
      g.beginPath();
      ref.forEach((r, m) => { const x = X(m), y = Y(r[idx]); m ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.setLineDash(style); g.lineWidth = width;
      g.strokeStyle = idx === 1 ? "#4a8fd9" : "rgba(128,128,128,.75)";
      g.stroke(); g.setLineDash([]);
    };
    // 3〜97の帯を薄く塗る
    g.beginPath();
    ref.forEach((r, m) => { const x = X(m), y = Y(r[2]); m ? g.lineTo(x, y) : g.moveTo(x, y); });
    for (let m = ref.length - 1; m >= 0; m--) g.lineTo(X(m), Y(ref[m][0]));
    g.closePath(); g.fillStyle = "rgba(74,143,217,.07)"; g.fill();
    drawRef(0, [2, 3], 1);
    drawRef(2, [2, 3], 1);
    drawRef(1, [5, 4], 1.5);

    // 実測値
    if (series.length) {
      g.beginPath();
      series.forEach((r, i) => { const x = X(r.months), y = Y(r[growthKind]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = "#f2836b"; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = "#f2836b";
      series.forEach((r) => { g.beginPath(); g.arc(X(r.months), Y(r[growthKind]), 3.5, 0, Math.PI * 2); g.fill(); });
    }
    g.fillStyle = inkC;
  }

  // ==========================================================================
  //  献立（フードロス対策）
  // ==========================================================================
  function renderMenu(view) {
    const stock = stockSorted();
    const res = State.data.plan;

    view.innerHTML = `
      <section class="card">
        <h2>🍳 使い切り献立</h2>
        <p class="muted">1歳児の1食は20〜80gと少量なので、買った食材は必ず余ります。
          <b>期限が近いものから優先して使う献立</b>を組み、余りは冷凍と大人の食事へ回すことで
          フードロスを防ぎます。</p>
        <div class="row wrap" style="margin-top:12px">
          <div class="seg">
            ${[2, 3, 5, 7].map((d) => `<button class="seg-btn ${planDays === d ? "active" : ""}" data-days="${d}">${d}日分</button>`).join("")}
          </div>
          <button class="btn primary" id="gen">献立を作る</button>
        </div>
        ${!stock.length ? `<div class="warn-box">在庫が未登録です。下の「食材の在庫」に、いま冷蔵庫にあるものを入れると
          使い切り献立が作れます。在庫が空でも献立は作れますが、その場合は買い物リストが長くなります。</div>` : ""}
      </section>

      ${res ? renderPlanResult(res) : ""}

      <section class="card">
        <h3>🧊 食材の在庫</h3>
        <p class="muted">量と期限を入れておくと、期限順に使い切る献立が作れます。
          食事を記録すると、その分だけ自動で減ります。</p>
        <div class="form-grid">
          <label>食材
            <select id="s-name">
              ${FOODS.map((f) => `<option value="${esc(f.name)}">${esc(f.name)}</option>`).join("")}
            </select></label>
          <label>量(g)<input type="number" id="s-g" min="1" step="10" placeholder="150"></label>
          <label>保存場所
            <select id="s-place">
              ${Object.entries(PLACES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
            </select></label>
          <label>期限（未入力なら自動）<input type="date" id="s-exp"></label>
        </div>
        <button class="btn" id="s-add">在庫に追加</button>

        ${stock.length ? `<ul class="stock">
          ${stock.map((s) => {
            const d = daysLeft(s), sv = servingsLeft(s);
            const cls = d < 0 ? "over" : d <= 2 ? "soon" : "";
            return `<li class="${cls}">
              <div class="st-name">${esc(s.name)}
                <small>${fmt(s.g)}g${sv ? " ・約" + fmt(sv, 1) + "食分" : ""} / ${PLACES[s.place] || ""} / 期限 ${esc(stockExpire(s))}</small></div>
              <span class="st-days ${cls}">${d < 0 ? "期限切れ" : d === 0 ? "今日まで" : "あと" + d + "日"}</span>
              <button class="x" data-sdel="${esc(s.id)}">✕</button></li>`;
          }).join("")}
        </ul>` : ""}
      </section>`;

    $$("[data-days]").forEach((b) => (b.onclick = () => { planDays = Number(b.dataset.days); render(); }));
    $("#gen").onclick = () => {
      State.data.plan = generatePlan(planDays);
      State.save(); render();
    };
    $("#s-add").onclick = () => {
      const name = $("#s-name").value, g = num($("#s-g").value);
      if (!name || g <= 0) { alert("食材と量を入れてください。"); return; }
      State.data.stock.push({
        id: "s" + Date.now() + Math.random().toString(36).slice(2, 6),
        name, g, place: $("#s-place").value, buy: todayStr(), exp: $("#s-exp").value || "",
      });
      State.save(); render();
    };
    $$("[data-sdel]").forEach((b) => (b.onclick = () => {
      State.data.stock = State.data.stock.filter((s) => s.id !== b.dataset.sdel);
      State.save(); render();
    }));
    if ($("#go-menu")) $("#go-menu").onclick = () => Nav.go("menu");
  }

  function renderPlanResult(res) {
    const tips = leftoverAdvice(res.leftover);
    const rateTone = res.useRate >= 80 ? "good" : res.useRate >= 50 ? "warn" : "bad";
    return `
      <section class="card">
        <div class="row between wrap"><h3>${res.days}日分の献立</h3>
          <span class="muted">${new Date(res.generatedAt).toLocaleString("ja-JP")} 作成</span></div>
        <div class="kpi-grid">
          <div class="kpi ${rateTone}"><div class="kpi-l">在庫の使い切り率</div>
            <div class="kpi-v">${fmt(res.useRate)}<small>%</small></div>
            <div class="kpi-s">${fmt(res.usedG)}g / ${fmt(res.initialG)}g</div></div>
          <div class="kpi info"><div class="kpi-l">買い足し</div>
            <div class="kpi-v">${res.shopping.length}<small>品</small></div>
            <div class="kpi-s">不足分のみ</div></div>
          <div class="kpi ${res.leftover.length ? "warn" : "good"}"><div class="kpi-l">使い切れない在庫</div>
            <div class="kpi-v">${res.leftover.length}<small>品</small></div>
            <div class="kpi-s">${res.leftover.length ? "冷凍などで対応" : "全部使えます"}</div></div>
        </div>

        <div class="plan">
          ${res.plan.map((d, i) => `
            <div class="planday">
              <h4><span>${i === 0 ? "今日" : i === 1 ? "明日" : esc(d.date)}</span>
                <small class="muted">${esc(d.date)}</small></h4>
              ${d.slots.map((s) => {
                const meta = MEAL_SLOTS.find((m) => m.key === s.slot);
                return `<div class="planslot">
                  <div class="ps-label">${meta.icon} ${meta.label}</div>
                  <div class="ps-dishes">
                    ${s.dishes.length ? s.dishes.map((r) => `<span class="dish ${r.share ? "share" : ""} ${r.frz ? "frz" : ""}"
                      title="${esc(r.how || "")}">${esc(r.name)}${r.share ? " 👨‍🍳" : ""}${r.frz ? " 🧊" : ""}</span>`).join("")
                      : `<span class="muted">—</span>`}
                  </div></div>`;
              }).join("")}
            </div>`).join("")}
        </div>
        <p class="muted">👨‍🍳 = 大人の料理から取り分けできる（味付け前に取り分ける）/ 🧊 = 多めに作って小分け冷凍できる。
          料理名にカーソルを合わせる（スマホは長押し）と作り方が出ます。</p>
      </section>

      ${res.shopping.length ? `<section class="card">
        <h3>🛒 買い足しリスト</h3>
        <p class="muted">在庫で足りない分だけです。ここに無いものは買わなくて済みます。</p>
        <div class="scroll-x"><table class="tbl">
          <thead><tr><th>食材</th><th class="num">必要量</th><th>ひとことメモ</th></tr></thead>
          <tbody>${res.shopping.map((s) => {
            const f = foodByName[s.name];
            const packs = f && f.unit ? s.g / f.unit : null;
            return `<tr><td>${esc(s.name)}</td><td class="num">${fmt(s.g)}g</td>
              <td class="muted">${packs && packs < 0.5
                ? `1パック(${f.unit}g目安)で足ります。残りは冷凍か大人用に。`
                : packs ? `約${fmt(packs, 1)}パック分` : ""}</td></tr>`;
          }).join("")}</tbody>
        </table></div>
      </section>` : ""}

      ${res.leftover.length ? `<section class="card">
        <h3>♻️ 余る在庫の使い切り方</h3>
        <ul class="stock">
          ${res.leftover.map((l) => `<li class="${l.days < 0 ? "over" : l.days <= 2 ? "soon" : ""}">
            <div class="st-name">${esc(l.name)}<small>残り ${fmt(l.g)}g</small></div>
            <span class="st-days ${l.days <= 2 ? "soon" : ""}">${l.days < 0 ? "期限切れ" : "あと" + l.days + "日"}</span>
            <span></span></li>`).join("")}
        </ul>
        ${tips.map((t) => `<div class="advice-item"><span class="ai-icon">💡</span><span>${esc(t)}</span></div>`).join("")}
      </section>` : `<section class="card">
        <div class="good-box">この献立で在庫を使い切れます。買い足しも不足分だけで済みます。</div>
      </section>`}`;
  }

  // ==========================================================================
  //  食材（初めて食べた記録・アレルギー）
  // ==========================================================================
  function renderFoods(view) {
    const ff = State.data.firstFoods;
    const months = monthsOld(State.data.profile.birth) || 14;
    const names = Object.keys(ff).sort((a, b) => (ff[b].date || "").localeCompare(ff[a].date || ""));
    const tried = new Set(names);
    // まだ試していない、月齢に合う食材
    const notYet = FOODS.filter((f) => !tried.has(f.name) && f.from <= months);
    const allergenTried = {};
    Object.entries(ALLERGENS).forEach(([k, v]) => {
      const foods = FOODS.filter((f) => (f.algn || []).includes(k));
      const done = foods.filter((f) => tried.has(f.name));
      allergenTried[k] = { label: v.label, rank: v.rank, total: foods.length, done: done.length, ok: done.some((f) => ff[f.name].status === "ok") };
    });

    view.innerHTML = `
      <section class="card">
        <h2>🥕 食材とアレルギー</h2>
        <p class="muted">食事に食材を追加すると、自動で「初めて食べた日」として登録されます。
          問題なければ「OK」、気になる症状が出たら「要注意」に切り替えてください。</p>
        <div class="warn-box">初めての食材は<b>平日の午前中に1種類だけ・少量から</b>。
          万一の症状があってもすぐ受診できる時間帯にするのが基本です。
          口の周りの赤み、じんましん、嘔吐、咳、機嫌の急変などが出たら記録して受診を。</div>
      </section>

      <section class="card">
        <h3>アレルギー表示対象の進み具合</h3>
        <p class="muted">特定原材料は特に慎重に。少量から進めた記録を残しておくと、保育園の申告にも使えます。</p>
        <ul class="chips">
          ${Object.entries(allergenTried).map(([k, a]) => `
            <li class="chip ${a.ok ? "ok" : a.done ? "new" : ""}" style="padding-right:12px">
              ${esc(a.label)}
              <span class="badge sm ${a.ok ? "good" : a.done ? "warn" : "info"}">${a.ok ? "確認済" : a.done ? "試行中" : "未"}</span>
            </li>`).join("")}
        </ul>
      </section>

      <section class="card">
        <h3>試した食材（${names.length}品）</h3>
        ${names.length ? `<div class="scroll-x"><table class="tbl">
          <thead><tr><th>食材</th><th>初回</th><th>状態</th><th>症状メモ</th></tr></thead>
          <tbody>
            ${names.map((n) => {
              const r = ff[n], f = foodByName[n];
              return `<tr>
                <td>${esc(n)}${f && f.algn ? ` <span class="badge sm info">${f.algn.map((a) => ALLERGENS[a] ? ALLERGENS[a].label : a).join("/")}</span>` : ""}</td>
                <td>${esc(r.date || "")}</td>
                <td><select data-st="${esc(n)}" style="padding:5px 8px;font-size:13px">
                  <option value="trying" ${r.status === "trying" ? "selected" : ""}>試行中</option>
                  <option value="ok" ${r.status === "ok" ? "selected" : ""}>OK</option>
                  <option value="ng" ${r.status === "ng" ? "selected" : ""}>要注意</option>
                </select></td>
                <td><input type="text" data-sym="${esc(n)}" value="${esc(r.symptom)}" placeholder="なし"
                  style="padding:5px 8px;font-size:13px"></td></tr>`;
            }).join("")}
          </tbody></table></div>
          <button class="btn primary block" id="ff-save">状態を保存</button>`
          : `<p class="muted">まだ記録がありません。</p>`}
      </section>

      <section class="card">
        <h3>まだ試していない食材（月齢に合うもの）</h3>
        ${notYet.length ? `<ul class="chips">
          ${notYet.map((f) => `<li class="chip" style="padding-right:12px">${esc(f.name)}
            ${f.algn ? `<span class="badge sm warn">${f.algn.map((a) => ALLERGENS[a] ? ALLERGENS[a].label : a).join("/")}</span>` : ""}</li>`).join("")}
        </ul>` : `<p class="muted">月齢に合う食材はすべて試しています。</p>`}
      </section>`;

    if ($("#ff-save")) {
      $("#ff-save").onclick = () => {
        $$("[data-st]").forEach((s) => { ff[s.dataset.st].status = s.value; });
        $$("[data-sym]").forEach((s) => { ff[s.dataset.sym].symptom = s.value.trim(); });
        State.save(); render();
      };
    }
  }

  // ==========================================================================
  //  プロフィール
  // ==========================================================================
  function renderProfile(view) {
    const p = State.data.profile || { name: "", birth: "", sex: "female" };
    const months = p.birth ? monthsOld(p.birth) : null;
    const st = stageOf(months);
    const goals = driFor(months, p.sex);

    view.innerHTML = `
      <section class="card">
        <h2>お子さんのプロフィール</h2>
        <p class="muted">生年月日から月齢を計算し、月齢に合った基準値・食材・レシピに切り替えます。</p>
        <div class="form-grid">
          <label>お名前<input type="text" id="p-name" value="${esc(p.name)}" placeholder="例: はな"></label>
          <label>生年月日<input type="date" id="p-birth" value="${esc(p.birth)}" max="${todayStr()}"></label>
          <label>性別<select id="p-sex">
            <option value="female" ${p.sex === "female" ? "selected" : ""}>女の子</option>
            <option value="male" ${p.sex === "male" ? "selected" : ""}>男の子</option>
          </select></label>
        </div>
        <button class="btn primary block" id="p-save">保存する</button>
      </section>

      ${p.birth ? `<section class="card">
        <h3>いまの月齢と目安</h3>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-l">月齢</div><div class="kpi-v">${months}<small>ヶ月</small></div>
            <div class="kpi-s">${ageLabel(p.birth)}</div></div>
          <div class="kpi info"><div class="kpi-l">段階</div><div class="kpi-v" style="font-size:19px">${st ? esc(st.name) : "—"}</div>
            <div class="kpi-s">${st ? esc(st.texture) : ""}</div></div>
          <div class="kpi"><div class="kpi-l">1日の食事</div><div class="kpi-v">${st ? st.meals : "—"}<small>回</small></div>
            <div class="kpi-s">${st ? esc(st.milk) : ""}</div></div>
        </div>
        <h3 style="margin-top:16px">1日の目標量（${esc(goals._label)}・${p.sex === "male" ? "男の子" : "女の子"}）</h3>
        <div class="scroll-x"><table class="tbl">
          <thead><tr><th>栄養素</th><th class="num">目標</th><th>考え方</th></tr></thead>
          <tbody>
            ${NUT_META.filter((m) => goals[m.goal]).map((m) => `<tr>
              <td>${m.label}</td><td class="num">${fmt(goals[m.goal], m.d)}${m.unit}</td>
              <td class="muted">${m.key === "salt" ? "これ未満に抑える" : "これを目指す"}</td></tr>`).join("")}
          </tbody></table></div>
        <p class="disclaimer">出典: 厚生労働省「日本人の食事摂取基準(2020年版)」をもとにした参照値。
          食塩相当量は目標量（未満）、ビタミンDは目安量、他は推奨量にあたる値です。</p>
      </section>` : ""}`;

    $("#p-save").onclick = () => {
      const name = $("#p-name").value.trim(), birth = $("#p-birth").value, sex = $("#p-sex").value;
      if (!name || !birth) { alert("お名前と生年月日を入れてください。"); return; }
      if (birth > todayStr()) { alert("生年月日が未来になっています。"); return; }
      State.data.profile = { name, birth, sex };
      State.save();
      Nav.go("home");
    };
  }

  // ==========================================================================
  //  設定
  // ==========================================================================
  function renderSettings(view) {
    const s = State.data.settings;
    const days = Object.keys(State.data.logs).length;
    view.innerHTML = `
      <section class="card">
        <h2>設定</h2>
        <label class="block">1日のおやつの回数
          <select id="snack">
            ${[0, 1, 2].map((n) => `<option value="${n}" ${num(s.snackPerDay, 1) === n ? "selected" : ""}>${n}回</option>`).join("")}
          </select></label>
        <p class="muted">1〜2歳は3食で必要量に届きにくいため、おやつは「4回目の食事」として1〜2回が一般的です。
          献立の生成にも反映されます。</p>
        <button class="btn primary" id="set-save">保存</button>
      </section>

      <section class="card">
        <h3>データ管理</h3>
        <p class="muted">記録日数: <b>${days}日</b> / 在庫 <b>${State.data.stock.length}件</b> /
          試した食材 <b>${Object.keys(State.data.firstFoods).length}品</b></p>
        <p class="muted">データはこの端末のブラウザ内（localStorage）にのみ保存され、外部には送信されません。
          機種変更や万一の消失に備えて、ときどき書き出しておくと安心です。</p>
        <div class="row wrap">
          <button class="btn" id="exp">JSONで書き出し</button>
          <label class="btn">JSONを読み込み<input type="file" id="imp" accept="application/json" hidden></label>
          <button class="btn danger" id="reset">全データを消去</button>
        </div>
      </section>

      <section class="card">
        <h3>この記録を健診で見せるとき</h3>
        <p class="muted">「成長」タブの記録一覧と、「食材」タブのアレルギー記録は、
          乳幼児健診や保育園の面談でそのまま見せられます。画面をスクリーンショットするか、
          ブラウザの共有メニューから印刷（PDF保存）してください。</p>
      </section>

      <section class="card">
        <h3>数値の根拠</h3>
        <ul class="muted" style="padding-left:20px">
          <li>栄養値: 文部科学省「日本食品標準成分表」をもとにした概算</li>
          <li>目標量: 厚生労働省「日本人の食事摂取基準(2020年版)」</li>
          <li>成長曲線: 厚生労働省「乳幼児身体発育調査」をもとにした概算の参照値</li>
          <li>食事の進め方: 厚生労働省「授乳・離乳の支援ガイド」の一般的な目安</li>
        </ul>
        <p class="disclaimer">いずれも概算です。正式な成長曲線は母子健康手帳を参照してください。
          このアプリは記録と傾向の把握を助けるもので、診断や治療の判断には使えません。
          気になることは小児科医・管理栄養士にご相談ください。</p>
      </section>`;

    $("#set-save").onclick = () => {
      s.snackPerDay = num($("#snack").value, 1);
      State.save(); render();
    };
    $("#exp").onclick = () => {
      const blob = new Blob([JSON.stringify(State.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `baby-healthcare-${todayStr()}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    };
    $("#imp").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const d = JSON.parse(fr.result);
          if (!d || typeof d !== "object") throw new Error("形式が違います");
          State.data = Object.assign(State.blank(), d);
          State.save(); alert("読み込みました。"); render();
        } catch (err) { alert("読み込めませんでした: " + err.message); }
      };
      fr.readAsText(file);
    };
    $("#reset").onclick = () => {
      if (!confirm("すべての記録を消去します。元に戻せません。よろしいですか？")) return;
      localStorage.removeItem(STORE_KEY);
      State.load(); Nav.go("profile");
    };
  }

  // ==========================================================================
  //  起動
  // ==========================================================================
  State.load();
  render();
  window.addEventListener("resize", () => { if (Nav.current === "growth") drawGrowth(); });
})();
