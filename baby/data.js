/* ==========================================================================
 * data.js — 乳幼児の栄養・食事・成長記録アプリの静的データ
 *   - DRI      : 年齢区分別の食事摂取基準（1〜2歳 / 3〜5歳）
 *   - FOODS    : 幼児食向け食品DB（可食部100gあたり＋1歳児の1食目安量）
 *   - RECIPES  : 取り分け・使い切りを前提とした幼児食レシピ
 *   - GROWTH   : 乳幼児身体発育曲線の参照値（パーセンタイル）
 *   - ALLERGENS: 特定原材料（アレルギー表示対象）
 * 依存ライブラリなし。plain script として読み込み、window に公開する。
 *
 * 【数値の扱い】
 *   栄養値は文部科学省「日本食品標準成分表」、基準値は厚生労働省
 *   「日本人の食事摂取基準(2020年版)」、成長曲線は厚生労働省
 *   「乳幼児身体発育調査」をもとにした【概算・参照値】である。
 *   医学的判断には使えない。正式な成長曲線は母子健康手帳を参照すること。
 * ======================================================================== */

// ---------------------------------------------------------------------------
//  食事摂取基準（1日あたり）
//    kcal   : 推定エネルギー必要量（身体活動レベルII）
//    protein: たんぱく質 推奨量 g
//    ca     : カルシウム 推奨量 mg
//    fe     : 鉄 推奨量 mg
//    zn     : 亜鉛 推奨量 mg
//    vc     : ビタミンC 推奨量 mg
//    vd     : ビタミンD 目安量 µg
//    fiber  : 食物繊維 目標量 g（1〜2歳は基準なし → null）
//    salt   : 食塩相当量 目標量 g未満（上限として扱う）
//    fatPct : 脂質 目標量（%エネルギー）
//    carbPct: 炭水化物 目標量（%エネルギー）
// ---------------------------------------------------------------------------
const DRI = {
  "1-2": {
    label: "1〜2歳",
    male:   { kcal: 950, protein: 20, ca: 450, fe: 4.5, zn: 3, vc: 40, vd: 3.0, fiber: null, salt: 3.0, vaUL: 600 },
    female: { kcal: 900, protein: 20, ca: 400, fe: 4.5, zn: 3, vc: 40, vd: 3.0, fiber: null, salt: 3.0, vaUL: 600 },
    fatPct: [20, 30], carbPct: [50, 65],
  },
  "3-5": {
    label: "3〜5歳",
    male:   { kcal: 1300, protein: 25, ca: 600, fe: 5.5, zn: 4, vc: 50, vd: 3.5, fiber: 8, salt: 3.5, vaUL: 700 },
    female: { kcal: 1250, protein: 25, ca: 550, fe: 5.5, zn: 3, vc: 50, vd: 4.0, fiber: 8, salt: 3.5, vaUL: 850 },
    fatPct: [20, 30], carbPct: [50, 65],
  },
  // 参考: 6〜11ヶ月（離乳期）は「授乳・離乳の支援ガイド」に沿った目安のみ
  "0-0": {
    label: "0歳(離乳期)",
    male:   { kcal: 700, protein: 15, ca: 250, fe: 5.0, zn: 3, vc: 40, vd: 5.0, fiber: null, salt: 1.5, vaUL: 600 },
    female: { kcal: 650, protein: 15, ca: 250, fe: 4.5, zn: 3, vc: 40, vd: 5.0, fiber: null, salt: 1.5, vaUL: 600 },
    fatPct: [40, 40], carbPct: [50, 65],
  },
};

// 月齢から年齢区分キーを引く
function driKeyForMonths(m) {
  if (m < 12) return "0-0";
  if (m < 36) return "1-2";
  return "3-5";
}

// ---------------------------------------------------------------------------
//  食品DB
//    per100: 可食部100gあたり kcal / p たんぱく質g / f 脂質g / c 炭水化物g
//            fiber 食物繊維g / ca mg / fe mg / zn mg / vc mg / vd µg / salt g
//    serv  : 1歳児の1食あたり目安量(g)  ← 少量なので食材が余りやすい
//    unit  : 買い物の最小単位のおおよそのg数（使い切り計算に使う）
//    from  : 食べさせられる目安の月齢
//    frz   : 冷凍ストック向き
//    share : 大人の料理から取り分けやすい
//    algn  : アレルギー表示対象（ALLERGENS のキー）
// ---------------------------------------------------------------------------
const FOODS = [
  // ===== 主食 =====
  { name: "軟飯",             cat: "主食", per100: { kcal: 113, p: 1.8, f: 0.2, c: 25.0, fiber: 1.0, ca: 2, fe: 0.1, zn: 0.4, vc: 0, vd: 0, salt: 0 },   serv: 80, unit: 300, from: 9,  frz: true,  share: true },
  { name: "ごはん(白米)",     cat: "主食", per100: { kcal: 156, p: 2.5, f: 0.3, c: 37.1, fiber: 1.5, ca: 3, fe: 0.1, zn: 0.6, vc: 0, vd: 0, salt: 0 },   serv: 80, unit: 300, from: 12, frz: true,  share: true },
  { name: "5倍粥",            cat: "主食", per100: { kcal: 71,  p: 1.1, f: 0.1, c: 15.6, fiber: 0.6, ca: 2, fe: 0.1, zn: 0.3, vc: 0, vd: 0, salt: 0 },   serv: 90, unit: 300, from: 7,  frz: true,  share: false },
  { name: "食パン",           cat: "主食", per100: { kcal: 248, p: 8.9, f: 4.1, c: 46.4, fiber: 2.7, ca: 22, fe: 0.5, zn: 0.8, vc: 0, vd: 0, salt: 1.2 }, serv: 25, unit: 360, from: 8,  frz: true,  share: true, algn: ["wheat"] },
  { name: "うどん(ゆで)",     cat: "主食", per100: { kcal: 95,  p: 2.6, f: 0.4, c: 21.6, fiber: 1.3, ca: 6, fe: 0.2, zn: 0.1, vc: 0, vd: 0, salt: 0.3 }, serv: 70, unit: 200, from: 7,  frz: true,  share: true, algn: ["wheat"] },
  { name: "そうめん(ゆで)",   cat: "主食", per100: { kcal: 114, p: 3.5, f: 0.4, c: 25.8, fiber: 1.0, ca: 6, fe: 0.2, zn: 0.2, vc: 0, vd: 0, salt: 0.2 }, serv: 60, unit: 100, from: 7,  frz: true,  share: true, algn: ["wheat"] },
  { name: "スパゲッティ(ゆで)", cat: "主食", per100: { kcal: 150, p: 5.8, f: 0.9, c: 32.2, fiber: 3.0, ca: 8, fe: 0.7, zn: 0.7, vc: 0, vd: 0, salt: 0.4 }, serv: 60, unit: 200, from: 12, frz: true, share: true, algn: ["wheat"] },
  { name: "じゃがいも",       cat: "主食", per100: { kcal: 76,  p: 1.6, f: 0.1, c: 17.6, fiber: 1.3, ca: 4, fe: 0.4, zn: 0.2, vc: 28, vd: 0, salt: 0 },  serv: 40, unit: 150, from: 6,  frz: false, share: true },
  { name: "さつまいも",       cat: "主食", per100: { kcal: 131, p: 1.2, f: 0.2, c: 31.9, fiber: 2.3, ca: 40, fe: 0.5, zn: 0.2, vc: 29, vd: 0, salt: 0 }, serv: 40, unit: 250, from: 6,  frz: true,  share: true },
  { name: "オートミール",     cat: "主食", per100: { kcal: 350, p: 13.7, f: 5.7, c: 69.1, fiber: 9.4, ca: 47, fe: 3.9, zn: 2.1, vc: 0, vd: 0, salt: 0 }, serv: 15, unit: 300, from: 8,  frz: false, share: false, algn: ["wheat"] },

  // ===== 主菜(たんぱく源) =====
  { name: "鶏ささみ",         cat: "主菜", per100: { kcal: 98,  p: 23.9, f: 0.8, c: 0.1, fiber: 0, ca: 4, fe: 0.3, zn: 0.6, vc: 3, vd: 0, salt: 0.1 },   serv: 20, unit: 200, from: 7,  frz: true,  share: true },
  { name: "鶏ひき肉",         cat: "主菜", per100: { kcal: 171, p: 17.5, f: 12.0, c: 0, fiber: 0, ca: 8, fe: 0.8, zn: 1.1, vc: 1, vd: 0.1, salt: 0.1 },  serv: 20, unit: 200, from: 9,  frz: true,  share: true },
  { name: "鶏もも肉(皮なし)", cat: "主菜", per100: { kcal: 113, p: 19.0, f: 5.0, c: 0, fiber: 0, ca: 5, fe: 0.6, zn: 1.8, vc: 3, vd: 0.2, salt: 0.2 },   serv: 25, unit: 250, from: 9,  frz: true,  share: true },
  { name: "豚ひき肉",         cat: "主菜", per100: { kcal: 209, p: 17.7, f: 17.2, c: 0.1, fiber: 0, ca: 6, fe: 1.0, zn: 2.8, vc: 1, vd: 0.4, salt: 0.1 }, serv: 20, unit: 200, from: 9,  frz: true,  share: true },
  { name: "牛ひき肉",         cat: "主菜", per100: { kcal: 251, p: 17.1, f: 21.1, c: 0.3, fiber: 0, ca: 6, fe: 2.4, zn: 5.2, vc: 1, vd: 0.1, salt: 0.2 }, serv: 20, unit: 200, from: 9,  frz: true,  share: true },
  { name: "白身魚(たら)",     cat: "主菜", per100: { kcal: 72,  p: 17.6, f: 0.2, c: 0.1, fiber: 0, ca: 32, fe: 0.2, zn: 0.5, vc: 0, vd: 1.0, salt: 0.3 }, serv: 20, unit: 150, from: 6,  frz: true,  share: true },
  { name: "鮭",               cat: "主菜", per100: { kcal: 124, p: 22.3, f: 4.1, c: 0.1, fiber: 0, ca: 14, fe: 0.5, zn: 0.5, vc: 1, vd: 32.0, salt: 0.2 }, serv: 20, unit: 150, from: 8,  frz: true,  share: true, algn: ["salmon"] },
  { name: "ツナ水煮(食塩無)", cat: "主菜", per100: { kcal: 71,  p: 16.0, f: 0.7, c: 0.2, fiber: 0, ca: 5, fe: 0.6, zn: 0.5, vc: 0, vd: 2.0, salt: 0.1 },  serv: 15, unit: 70,  from: 9,  frz: false, share: false },
  { name: "しらす干し",       cat: "主菜", per100: { kcal: 113, p: 24.5, f: 1.6, c: 0.1, fiber: 0, ca: 210, fe: 0.6, zn: 1.2, vc: 0, vd: 12.0, salt: 4.2 }, serv: 5,  unit: 40,  from: 7,  frz: true,  share: false, note: "塩分が高いので湯通しして少量" },
  { name: "卵",               cat: "主菜", per100: { kcal: 142, p: 12.2, f: 10.2, c: 0.4, fiber: 0, ca: 46, fe: 1.5, zn: 1.1, vc: 0, vd: 3.8, salt: 0.4 }, serv: 25, unit: 300, from: 6,  frz: false, share: true, algn: ["egg"] },
  { name: "木綿豆腐",         cat: "主菜", per100: { kcal: 73,  p: 7.0, f: 4.9, c: 1.5, fiber: 1.1, ca: 93, fe: 1.5, zn: 0.6, vc: 0, vd: 0, salt: 0 },     serv: 40, unit: 300, from: 6,  frz: false, share: true, algn: ["soy"] },
  { name: "納豆",             cat: "主菜", per100: { kcal: 190, p: 16.5, f: 10.0, c: 12.1, fiber: 6.7, ca: 90, fe: 3.3, zn: 1.9, vc: 0, vd: 0, salt: 0 },  serv: 20, unit: 45,  from: 8,  frz: true,  share: true, algn: ["soy"] },
  { name: "高野豆腐(乾)",     cat: "主菜", per100: { kcal: 496, p: 50.5, f: 34.1, c: 4.2, fiber: 2.5, ca: 630, fe: 7.5, zn: 5.2, vc: 0, vd: 0, salt: 1.1 }, serv: 4,  unit: 80,  from: 8,  frz: false, share: true, algn: ["soy"] },
  { name: "きな粉",           cat: "主菜", per100: { kcal: 451, p: 36.7, f: 25.7, c: 28.5, fiber: 18.1, ca: 190, fe: 8.0, zn: 4.1, vc: 0, vd: 0, salt: 0 }, serv: 3,  unit: 100, from: 7,  frz: false, share: false, algn: ["soy"] },
  { name: "鶏レバー",         cat: "主菜", per100: { kcal: 100, p: 18.9, f: 3.1, c: 0.6, fiber: 0, ca: 5, fe: 9.0, zn: 3.3, vc: 20, vd: 0.2, salt: 0.2 },  serv: 3,  unit: 100, from: 9,  frz: true,  share: false, vaHigh: 14000,
    note: "ビタミンAが約14,000µgRAE/100g。1〜2歳の耐容上限は600µgRAE/日なので、3〜4g・週1〜2回までに留める" },
  { name: "大豆水煮",         cat: "主菜", per100: { kcal: 124, p: 12.9, f: 6.7, c: 7.7, fiber: 6.6, ca: 100, fe: 1.8, zn: 1.1, vc: 0, vd: 0, salt: 0.5 }, serv: 15, unit: 120, from: 12, frz: true,  share: true, algn: ["soy"] },

  // ===== 乳製品 =====
  { name: "プレーンヨーグルト", cat: "乳製品", per100: { kcal: 56, p: 3.6, f: 3.0, c: 4.9, fiber: 0, ca: 120, fe: 0, zn: 0.4, vc: 1, vd: 0, salt: 0.1 },  serv: 60, unit: 400, from: 7,  frz: false, share: true, algn: ["milk"] },
  { name: "牛乳",             cat: "乳製品", per100: { kcal: 61, p: 3.3, f: 3.8, c: 4.8, fiber: 0, ca: 110, fe: 0, zn: 0.4, vc: 1, vd: 0.3, salt: 0.1 },  serv: 100, unit: 1000, from: 12, frz: false, share: true, algn: ["milk"] },
  { name: "プロセスチーズ",   cat: "乳製品", per100: { kcal: 313, p: 22.7, f: 26.0, c: 1.3, fiber: 0, ca: 630, fe: 0.3, zn: 3.2, vc: 0, vd: 0, salt: 2.8 }, serv: 10, unit: 100, from: 12, frz: false, share: true, algn: ["milk"], note: "塩分が高いので少量" },
  { name: "フォローアップミルク", cat: "乳製品", per100: { kcal: 460, p: 14.5, f: 17.0, c: 60.0, fiber: 0, ca: 700, fe: 9.0, zn: 3.0, vc: 60, vd: 8.0, salt: 0.5 }, serv: 20, unit: 800, from: 9, frz: false, share: false, algn: ["milk"] },

  // ===== 副菜(野菜) =====
  { name: "にんじん",         cat: "副菜", per100: { kcal: 30,  p: 0.7, f: 0.2, c: 9.3, fiber: 2.8, ca: 28, fe: 0.2, zn: 0.2, vc: 6, vd: 0, salt: 0.1 },  serv: 20, unit: 150, from: 5,  frz: true,  share: true },
  { name: "ほうれん草",       cat: "副菜", per100: { kcal: 18,  p: 2.2, f: 0.4, c: 3.1, fiber: 2.8, ca: 49, fe: 2.0, zn: 0.7, vc: 35, vd: 0, salt: 0 },   serv: 20, unit: 200, from: 5,  frz: true,  share: true },
  { name: "小松菜",           cat: "副菜", per100: { kcal: 13,  p: 1.5, f: 0.2, c: 2.4, fiber: 1.9, ca: 170, fe: 2.8, zn: 0.2, vc: 39, vd: 0, salt: 0 },  serv: 20, unit: 200, from: 6,  frz: true,  share: true },
  { name: "ブロッコリー",     cat: "副菜", per100: { kcal: 37,  p: 5.4, f: 0.6, c: 6.6, fiber: 5.1, ca: 50, fe: 1.3, zn: 0.8, vc: 140, vd: 0, salt: 0 },  serv: 20, unit: 250, from: 6,  frz: true,  share: true },
  { name: "かぼちゃ",         cat: "副菜", per100: { kcal: 78,  p: 1.9, f: 0.3, c: 20.6, fiber: 3.5, ca: 15, fe: 0.5, zn: 0.3, vc: 43, vd: 0, salt: 0 },  serv: 30, unit: 300, from: 5,  frz: true,  share: true },
  { name: "トマト",           cat: "副菜", per100: { kcal: 20,  p: 0.7, f: 0.1, c: 4.7, fiber: 1.0, ca: 7, fe: 0.2, zn: 0.1, vc: 15, vd: 0, salt: 0 },   serv: 30, unit: 150, from: 5,  frz: false, share: true },
  { name: "キャベツ",         cat: "副菜", per100: { kcal: 21,  p: 1.3, f: 0.2, c: 5.2, fiber: 1.8, ca: 43, fe: 0.3, zn: 0.2, vc: 41, vd: 0, salt: 0 },  serv: 25, unit: 800, from: 5,  frz: true,  share: true },
  { name: "玉ねぎ",           cat: "副菜", per100: { kcal: 33,  p: 1.0, f: 0.1, c: 8.4, fiber: 1.5, ca: 17, fe: 0.3, zn: 0.2, vc: 7, vd: 0, salt: 0 },   serv: 20, unit: 200, from: 6,  frz: true,  share: true },
  { name: "大根",             cat: "副菜", per100: { kcal: 15,  p: 0.4, f: 0.1, c: 4.1, fiber: 1.4, ca: 24, fe: 0.2, zn: 0.1, vc: 12, vd: 0, salt: 0 },  serv: 25, unit: 400, from: 5,  frz: true,  share: true },
  { name: "なす",             cat: "副菜", per100: { kcal: 18,  p: 1.1, f: 0.1, c: 5.1, fiber: 2.2, ca: 18, fe: 0.3, zn: 0.2, vc: 4, vd: 0, salt: 0 },   serv: 20, unit: 80,  from: 7,  frz: false, share: true },
  { name: "ピーマン",         cat: "副菜", per100: { kcal: 20,  p: 0.9, f: 0.2, c: 5.1, fiber: 2.3, ca: 11, fe: 0.4, zn: 0.2, vc: 76, vd: 0, salt: 0 },  serv: 15, unit: 120, from: 9,  frz: true,  share: true },
  { name: "とうもろこし",     cat: "副菜", per100: { kcal: 89,  p: 3.6, f: 1.7, c: 16.8, fiber: 3.0, ca: 3, fe: 0.8, zn: 1.0, vc: 8, vd: 0, salt: 0 },   serv: 20, unit: 200, from: 7,  frz: true,  share: true },
  { name: "さやいんげん",     cat: "副菜", per100: { kcal: 23,  p: 1.8, f: 0.1, c: 5.1, fiber: 2.4, ca: 48, fe: 0.7, zn: 0.3, vc: 8, vd: 0, salt: 0 },   serv: 15, unit: 150, from: 7,  frz: true,  share: true },
  { name: "アスパラガス",     cat: "副菜", per100: { kcal: 22,  p: 2.6, f: 0.2, c: 3.9, fiber: 1.8, ca: 19, fe: 0.7, zn: 0.5, vc: 15, vd: 0, salt: 0 },  serv: 15, unit: 100, from: 7,  frz: true,  share: true },
  { name: "オクラ",           cat: "副菜", per100: { kcal: 30,  p: 2.1, f: 0.2, c: 6.6, fiber: 5.0, ca: 92, fe: 0.5, zn: 0.6, vc: 11, vd: 0, salt: 0 },  serv: 15, unit: 100, from: 7,  frz: true,  share: true },
  { name: "白菜",             cat: "副菜", per100: { kcal: 13,  p: 0.8, f: 0.1, c: 3.2, fiber: 1.3, ca: 43, fe: 0.3, zn: 0.2, vc: 19, vd: 0, salt: 0 },  serv: 25, unit: 800, from: 6,  frz: true,  share: true },

  // ===== きのこ・海藻 =====
  { name: "しいたけ",         cat: "海藻きのこ", per100: { kcal: 25, p: 3.1, f: 0.3, c: 6.4, fiber: 4.9, ca: 1, fe: 0.4, zn: 0.9, vc: 0, vd: 0.4, salt: 0 }, serv: 10, unit: 100, from: 9, frz: true, share: true },
  { name: "えのきたけ",       cat: "海藻きのこ", per100: { kcal: 34, p: 2.7, f: 0.2, c: 7.6, fiber: 3.9, ca: 0, fe: 1.1, zn: 0.6, vc: 0, vd: 0.9, salt: 0 }, serv: 10, unit: 200, from: 9, frz: true, share: true },
  { name: "わかめ(戻し)",     cat: "海藻きのこ", per100: { kcal: 17, p: 1.9, f: 0.2, c: 3.4, fiber: 3.6, ca: 100, fe: 0.5, zn: 0.2, vc: 0, vd: 0, salt: 1.5 }, serv: 5, unit: 20, from: 9, frz: false, share: true, note: "ヨウ素が多いので少量" },
  { name: "焼きのり",         cat: "海藻きのこ", per100: { kcal: 297, p: 41.4, f: 3.7, c: 44.3, fiber: 36.0, ca: 280, fe: 11.4, zn: 3.6, vc: 210, vd: 0, salt: 1.3 }, serv: 1, unit: 30, from: 9, frz: false, share: true },
  { name: "ひじき(戻し)",     cat: "海藻きのこ", per100: { kcal: 11, p: 0.5, f: 0.1, c: 3.4, fiber: 3.7, ca: 96, fe: 0.3, zn: 0.1, vc: 0, vd: 0, salt: 0.1 }, serv: 5, unit: 30, from: 12, frz: true, share: true },

  // ===== 果物 =====
  { name: "バナナ",           cat: "果物", per100: { kcal: 93,  p: 1.1, f: 0.2, c: 22.5, fiber: 1.1, ca: 6, fe: 0.3, zn: 0.2, vc: 16, vd: 0, salt: 0 },  serv: 40, unit: 100, from: 6,  frz: true,  share: true },
  { name: "りんご",           cat: "果物", per100: { kcal: 53,  p: 0.1, f: 0.2, c: 15.5, fiber: 1.4, ca: 3, fe: 0.1, zn: 0, vc: 4, vd: 0, salt: 0 },     serv: 30, unit: 300, from: 5,  frz: false, share: true },
  { name: "みかん",           cat: "果物", per100: { kcal: 49,  p: 0.7, f: 0.1, c: 12.0, fiber: 1.0, ca: 21, fe: 0.2, zn: 0.1, vc: 32, vd: 0, salt: 0 }, serv: 40, unit: 100, from: 7,  frz: false, share: true },
  { name: "いちご",           cat: "果物", per100: { kcal: 31,  p: 0.9, f: 0.1, c: 8.5, fiber: 1.4, ca: 17, fe: 0.3, zn: 0.2, vc: 62, vd: 0, salt: 0 },  serv: 30, unit: 250, from: 7,  frz: true,  share: true },
  { name: "梨",               cat: "果物", per100: { kcal: 38,  p: 0.3, f: 0.1, c: 11.3, fiber: 0.9, ca: 2, fe: 0, zn: 0.1, vc: 3, vd: 0, salt: 0 },    serv: 30, unit: 300, from: 6,  frz: false, share: true },
  { name: "キウイ",           cat: "果物", per100: { kcal: 51,  p: 1.0, f: 0.2, c: 13.4, fiber: 2.6, ca: 26, fe: 0.3, zn: 0.1, vc: 71, vd: 0, salt: 0 }, serv: 25, unit: 100, from: 9,  frz: false, share: true, algn: ["kiwi"] },
  { name: "ブルーベリー",     cat: "果物", per100: { kcal: 48,  p: 0.5, f: 0.1, c: 12.9, fiber: 3.3, ca: 8, fe: 0.2, zn: 0.1, vc: 9, vd: 0, salt: 0 },   serv: 20, unit: 100, from: 8,  frz: true,  share: true },

  // ===== 調味・その他 =====
  { name: "麦茶",             cat: "飲みもの", per100: { kcal: 1, p: 0, f: 0, c: 0.3, fiber: 0, ca: 2, fe: 0, zn: 0, vc: 0, vd: 0, salt: 0 },  serv: 100, unit: 1000, from: 5, frz: false, share: true },
  { name: "だし汁(かつお昆布)", cat: "調味料", per100: { kcal: 2, p: 0.3, f: 0, c: 0.3, fiber: 0, ca: 3, fe: 0, zn: 0, vc: 0, vd: 0, salt: 0.1 }, serv: 60, unit: 500, from: 5, frz: true, share: true },
  { name: "みそ",             cat: "調味料", per100: { kcal: 192, p: 12.5, f: 6.0, c: 21.9, fiber: 4.9, ca: 100, fe: 4.0, zn: 1.1, vc: 0, vd: 0, salt: 12.4 }, serv: 2, unit: 500, from: 7, frz: false, share: true, algn: ["soy"], note: "塩分が高い。1歳は1食2g程度まで" },
  { name: "しょうゆ",         cat: "調味料", per100: { kcal: 77, p: 7.7, f: 0, c: 7.9, fiber: 0, ca: 29, fe: 1.7, zn: 0.9, vc: 0, vd: 0, salt: 14.5 }, serv: 1, unit: 500, from: 9, frz: false, share: true, algn: ["wheat", "soy"], note: "塩分が高い。ごく少量" },
  { name: "植物油",           cat: "調味料", per100: { kcal: 921, p: 0, f: 100, c: 0, fiber: 0, ca: 0, fe: 0, zn: 0, vc: 0, vd: 0, salt: 0 },  serv: 2, unit: 400, from: 7, frz: false, share: true },
  { name: "バター(食塩不使用)", cat: "調味料", per100: { kcal: 720, p: 0.5, f: 83.0, c: 0.2, fiber: 0, ca: 14, fe: 0.1, zn: 0.1, vc: 0, vd: 0.7, salt: 0 }, serv: 2, unit: 200, from: 9, frz: true, share: true, algn: ["milk"] },
];

// ---------------------------------------------------------------------------
//  アレルギー表示対象（特定原材料等）
//    法令上の「特定原材料8品目」＋よく相談される品目を抜粋
// ---------------------------------------------------------------------------
const ALLERGENS = {
  egg:     { label: "卵",     rank: "特定原材料" },
  milk:    { label: "乳",     rank: "特定原材料" },
  wheat:   { label: "小麦",   rank: "特定原材料" },
  peanut:  { label: "落花生", rank: "特定原材料" },
  shrimp:  { label: "えび",   rank: "特定原材料" },
  crab:    { label: "かに",   rank: "特定原材料" },
  buckw:   { label: "そば",   rank: "特定原材料" },
  walnut:  { label: "くるみ", rank: "特定原材料" },
  soy:     { label: "大豆",   rank: "推奨表示" },
  salmon:  { label: "さけ",   rank: "推奨表示" },
  kiwi:    { label: "キウイ", rank: "推奨表示" },
  sesame:  { label: "ごま",   rank: "推奨表示" },
};

// ---------------------------------------------------------------------------
//  レシピDB（幼児食・取り分け前提）
//    kind : staple 主食 / main 主菜 / side 副菜 / soup 汁物 / snack おやつ
//    ings : [食品名, g]  ← g は「1歳児1食分」の量
//    share: 大人の料理から取り分けできる（＝食材を余らせない最大の武器）
//    frz  : 多めに作って冷凍小分けできる
//    min  : 目安の月齢
// ---------------------------------------------------------------------------
const RECIPES = [
  // --- 主食 ---
  { name: "軟飯",                     kind: "staple", min: 9,  time: 0,  share: true,  frz: true,  ings: [["軟飯", 80]], how: "大人のごはんを炊くとき、一部に湯を足して柔らかくする。小分け冷凍可。" },
  { name: "しらすとのりの混ぜごはん", kind: "staple", min: 9,  time: 5,  share: false, frz: true,  ings: [["軟飯", 80], ["しらす干し", 5], ["焼きのり", 1]], how: "しらすは湯通しして塩抜き。軟飯に混ぜるだけ。" },
  { name: "野菜たっぷりうどん",       kind: "staple", min: 9,  time: 10, share: true,  frz: true,  ings: [["うどん(ゆで)", 70], ["にんじん", 15], ["ほうれん草", 15], ["だし汁(かつお昆布)", 60]], how: "うどんは短く切る。大人のうどんから、味付け前に取り分ける。" },
  { name: "さつまいもごはん",         kind: "staple", min: 9,  time: 10, share: true,  frz: true,  ings: [["軟飯", 70], ["さつまいも", 30]], how: "蒸したさつまいもを潰して軟飯に混ぜる。" },
  { name: "トマトリゾット風",         kind: "staple", min: 12, time: 12, share: true,  frz: true,  ings: [["軟飯", 70], ["トマト", 30], ["玉ねぎ", 15], ["鶏ひき肉", 15], ["プロセスチーズ", 5]], how: "トマトと玉ねぎを煮て軟飯を加え、最後にチーズを溶かす。" },
  { name: "きな粉トースト",           kind: "staple", min: 12, time: 3,  share: false, frz: false, ings: [["食パン", 25], ["きな粉", 3], ["バター(食塩不使用)", 2]], how: "食パンは耳を落としてスティック状に。手づかみ練習に。" },
  { name: "オートミール粥",           kind: "staple", min: 9,  time: 5,  share: false, frz: false, ings: [["オートミール", 15], ["牛乳", 60], ["バナナ", 20]], how: "レンジで加熱してバナナを潰して混ぜる。鉄が摂れる。" },

  // --- 主菜 ---
  { name: "鶏ささみと野菜のあんかけ", kind: "main", min: 9,  time: 12, share: true,  frz: true,  ings: [["鶏ささみ", 20], ["にんじん", 15], ["キャベツ", 20], ["だし汁(かつお昆布)", 50]], how: "ささみは細かくほぐす。片栗粉でとろみをつけると食べやすい。" },
  { name: "白身魚のトマト煮",         kind: "main", min: 9,  time: 12, share: true,  frz: true,  ings: [["白身魚(たら)", 20], ["トマト", 30], ["玉ねぎ", 15]], how: "骨を丁寧に取る。大人用はここから取り分けて味付け。" },
  { name: "鮭とかぼちゃのホイル焼き", kind: "main", min: 12, time: 15, share: true,  frz: true,  ings: [["鮭", 20], ["かぼちゃ", 30], ["バター(食塩不使用)", 2]], how: "大人の分と一緒に焼き、子ども用は味付けなしで。ビタミンDが摂れる。" },
  { name: "豆腐ハンバーグ",           kind: "main", min: 12, time: 20, share: true,  frz: true,  ings: [["鶏ひき肉", 20], ["木綿豆腐", 30], ["玉ねぎ", 15], ["植物油", 2]], how: "多めに作って1個ずつ冷凍。大人はソースで味変。" },
  { name: "レバーと野菜のそぼろ",     kind: "main", min: 12, time: 15, share: false, frz: true,  maxPerWeek: 1, ings: [["鶏レバー", 3], ["鶏ひき肉", 18], ["にんじん", 15], ["だし汁(かつお昆布)", 30]], how: "鉄の補給に。レバーはビタミンAが多いので3g程度・週1回まで。残りは大人用に。" },
  { name: "牛ひき肉と野菜のそぼろ",   kind: "main", min: 12, time: 12, share: true,  frz: true,  ings: [["牛ひき肉", 20], ["にんじん", 15], ["玉ねぎ", 15], ["だし汁(かつお昆布)", 30]], how: "赤身肉の鉄はレバーより安全に量を増やせる。鉄の主役はこちら。" },
  { name: "納豆と野菜の和え物",       kind: "main", min: 9,  time: 5,  share: true,  frz: false, ings: [["納豆", 20], ["ほうれん草", 20]], how: "ひきわりにして刻んだ野菜と和える。鉄とたんぱく質。" },
  { name: "高野豆腐の卵とじ",         kind: "main", min: 12, time: 12, share: true,  frz: true,  ings: [["高野豆腐(乾)", 4], ["卵", 25], ["にんじん", 15], ["だし汁(かつお昆布)", 50]], how: "高野豆腐は戻して細かく。鉄・カルシウムが同時に摂れる。" },
  { name: "ツナと大根の煮物",         kind: "main", min: 12, time: 15, share: true,  frz: true,  ings: [["ツナ水煮(食塩無)", 15], ["大根", 30], ["にんじん", 15], ["だし汁(かつお昆布)", 50]], how: "ツナの旨味だけで味がつく。調味料不要。" },
  { name: "豚ひき肉と白菜のとろとろ煮", kind: "main", min: 12, time: 15, share: true, frz: true,  ings: [["豚ひき肉", 20], ["白菜", 30], ["玉ねぎ", 15], ["だし汁(かつお昆布)", 50]], how: "白菜が甘くなる。大人は鍋の素を足して展開。" },
  { name: "スクランブルエッグ",       kind: "main", min: 9,  time: 5,  share: true,  frz: false, ings: [["卵", 25], ["牛乳", 15], ["植物油", 2]], how: "しっかり加熱する。手づかみなら薄焼きにして棒状に。" },

  // --- 副菜 ---
  { name: "ブロッコリーの白和え",     kind: "side", min: 9,  time: 8,  share: true,  frz: false, ings: [["ブロッコリー", 20], ["木綿豆腐", 25]], how: "豆腐を潰して和えるだけ。カルシウムとビタミンC。" },
  { name: "にんじんグラッセ",         kind: "side", min: 9,  time: 10, share: true,  frz: true,  ings: [["にんじん", 25], ["バター(食塩不使用)", 2]], how: "甘く仕上がるので野菜嫌いにも。冷凍可。" },
  { name: "小松菜としらすの煮浸し",   kind: "side", min: 9,  time: 8,  share: true,  frz: true,  ings: [["小松菜", 20], ["しらす干し", 5], ["だし汁(かつお昆布)", 40]], how: "カルシウムと鉄の組み合わせ。しらすは湯通しを。" },
  { name: "かぼちゃの煮物",           kind: "side", min: 7,  time: 12, share: true,  frz: true,  ings: [["かぼちゃ", 30], ["だし汁(かつお昆布)", 40]], how: "潰しても形を残しても。冷凍ストックの定番。" },
  { name: "きゅうりとトマトの角切り", kind: "side", min: 12, time: 3,  share: true,  frz: false, ings: [["トマト", 30], ["大根", 20]], how: "生で食べられるようになったら。手づかみ練習に。" },
  { name: "さつまいものマッシュ",     kind: "side", min: 6,  time: 10, share: false, frz: true,  ings: [["さつまいも", 40], ["牛乳", 20]], how: "牛乳でのばす。おやつにもなる。" },
  { name: "ほうれん草のごま和え風",   kind: "side", min: 9,  time: 6,  share: true,  frz: true,  ings: [["ほうれん草", 25], ["きな粉", 3]], how: "ごまの代わりにきな粉で。鉄が増える。" },
  { name: "コーンと玉ねぎのソテー",   kind: "side", min: 12, time: 8,  share: true,  frz: true,  ings: [["とうもろこし", 20], ["玉ねぎ", 20], ["植物油", 2]], how: "自然な甘みで調味料いらず。" },
  { name: "大根とにんじんの含め煮",   kind: "side", min: 9,  time: 15, share: true,  frz: true,  ings: [["大根", 30], ["にんじん", 20], ["だし汁(かつお昆布)", 50]], how: "大人のおでんや煮物から取り分け（味付け前）。" },
  { name: "きのこの旨煮",             kind: "side", min: 12, time: 10, share: true,  frz: true,  ings: [["しいたけ", 10], ["えのきたけ", 10], ["にんじん", 15], ["だし汁(かつお昆布)", 40]], how: "細かく刻む。噛む練習になる。" },

  // --- 汁物 ---
  { name: "野菜のすまし汁",           kind: "soup", min: 9,  time: 8,  share: true,  frz: false, ings: [["だし汁(かつお昆布)", 80], ["にんじん", 10], ["白菜", 15]], how: "味付けはだしのみ。大人はここから味噌や塩を追加。" },
  { name: "豆腐とわかめのみそ汁",     kind: "soup", min: 12, time: 8,  share: true,  frz: false, ings: [["だし汁(かつお昆布)", 80], ["木綿豆腐", 20], ["わかめ(戻し)", 5], ["みそ", 2]], how: "大人の半分以下の味噌で。1歳は薄味が基本。" },
  { name: "かぼちゃのポタージュ",     kind: "soup", min: 9,  time: 12, share: true,  frz: true,  ings: [["かぼちゃ", 30], ["玉ねぎ", 15], ["牛乳", 50]], how: "ミキサーで滑らかに。冷凍ストック向き。" },

  // --- おやつ（1〜2歳は3食で足りない分を補う「4回目の食事」） ---
  { name: "バナナヨーグルト",         kind: "snack", min: 9,  time: 2,  share: false, frz: false, ings: [["プレーンヨーグルト", 60], ["バナナ", 30]], how: "砂糖不要。カルシウム補給に。" },
  { name: "蒸しさつまいも",           kind: "snack", min: 6,  time: 12, share: true,  frz: true,  ings: [["さつまいも", 40]], how: "スティック状にして手づかみ。作り置き・冷凍可。" },
  { name: "おにぎり(のり巻き)",       kind: "snack", min: 12, time: 5,  share: true,  frz: true,  ings: [["軟飯", 50], ["焼きのり", 1], ["しらす干し", 3]], how: "一口サイズに。のりは湿らせると噛み切りやすい。" },
  { name: "りんごのコンポート",       kind: "snack", min: 6,  time: 10, share: true,  frz: true,  ings: [["りんご", 40]], how: "砂糖なしで煮るだけ。ヨーグルトに添えても。" },
  { name: "きな粉ミルク",             kind: "snack", min: 9,  time: 2,  share: false, frz: false, ings: [["牛乳", 100], ["きな粉", 3]], how: "鉄とカルシウムを手軽に。" },
  { name: "チーズとフルーツ",         kind: "snack", min: 12, time: 2,  share: false, frz: false, ings: [["プロセスチーズ", 10], ["いちご", 30]], how: "チーズは塩分があるので少量に。" },
];

// ---------------------------------------------------------------------------
//  乳幼児身体発育曲線の参照値（厚生労働省 乳幼児身体発育調査ベースの概算）
//    月齢アンカーごとに [P3, P50, P97]。アンカー間は線形補間する。
//    ※正式な曲線は母子健康手帳を参照。ここでは傾向把握のための概算値。
// ---------------------------------------------------------------------------
const GROWTH = {
  note: "厚生労働省 乳幼児身体発育調査をもとにした概算の参照値。正式には母子健康手帳の曲線を参照すること。",
  months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24, 30, 36],
  male: {
    weight: [
      [2.10, 3.00, 3.76], [3.00, 4.30, 5.50], [3.90, 5.20, 6.60], [4.60, 6.00, 7.50],
      [5.20, 6.60, 8.20], [5.70, 7.10, 8.70], [6.10, 7.50, 9.20], [6.40, 7.90, 9.60],
      [6.70, 8.20, 9.90], [6.90, 8.50, 10.20], [7.10, 8.70, 10.50], [7.30, 8.90, 10.80],
      [7.50, 9.10, 11.00], [7.90, 9.80, 11.80], [8.40, 10.40, 12.60], [8.90, 11.00, 13.40],
      [9.40, 11.60, 14.20], [10.30, 12.70, 15.60], [11.20, 13.80, 17.00],
    ],
    height: [
      [44.0, 49.5, 52.6], [48.7, 54.5, 58.0], [52.2, 58.0, 61.8], [55.3, 61.5, 65.2],
      [57.8, 64.0, 67.8], [59.9, 66.0, 69.9], [61.5, 67.5, 71.6], [62.9, 69.0, 73.2],
      [64.2, 70.5, 74.6], [65.3, 71.5, 75.9], [66.4, 73.0, 77.1], [67.4, 74.0, 78.3],
      [68.4, 75.5, 79.4], [70.8, 78.0, 82.2], [73.0, 80.5, 84.8], [75.0, 83.0, 87.2],
      [77.0, 85.5, 89.6], [80.5, 89.5, 94.0], [83.6, 93.0, 98.0],
    ],
  },
  female: {
    weight: [
      [2.13, 2.95, 3.67], [2.90, 4.00, 5.10], [3.60, 4.80, 6.10], [4.20, 5.50, 6.90],
      [4.70, 6.00, 7.50], [5.10, 6.50, 8.10], [5.40, 6.90, 8.50], [5.70, 7.20, 8.90],
      [5.90, 7.50, 9.20], [6.10, 7.70, 9.50], [6.30, 8.00, 9.80], [6.50, 8.20, 10.10],
      [6.70, 8.50, 10.40], [7.20, 9.10, 11.20], [7.70, 9.70, 12.00], [8.20, 10.30, 12.80],
      [8.70, 10.90, 13.60], [9.60, 11.90, 14.90], [10.40, 13.00, 16.30],
    ],
    height: [
      [43.6, 48.5, 51.9], [47.9, 53.5, 57.0], [51.1, 57.0, 60.5], [54.0, 60.0, 63.8],
      [56.4, 62.5, 66.2], [58.4, 64.5, 68.3], [60.0, 66.0, 70.0], [61.4, 67.5, 71.6],
      [62.6, 69.0, 73.0], [63.8, 70.0, 74.3], [64.8, 71.5, 75.6], [65.8, 72.5, 76.8],
      [66.8, 74.0, 78.0], [69.2, 76.5, 80.8], [71.5, 79.0, 83.5], [73.6, 81.5, 86.0],
      [75.6, 84.0, 88.5], [79.1, 88.0, 92.9], [82.3, 91.5, 96.8],
    ],
  },
};

// ---------------------------------------------------------------------------
//  カウプ指数（体重kg ÷ 身長m²）の判定帯 — 月齢で基準が変わる
// ---------------------------------------------------------------------------
const KAUP_BANDS = [
  { toMonth: 12,  thin: 14.5, lean: 15.5, fat: 18.0, obese: 19.5 },
  { toMonth: 18,  thin: 14.5, lean: 15.0, fat: 17.5, obese: 19.0 },
  { toMonth: 24,  thin: 14.0, lean: 15.0, fat: 17.0, obese: 18.5 },
  { toMonth: 999, thin: 13.5, lean: 14.5, fat: 16.5, obese: 18.0 },
];

// ---------------------------------------------------------------------------
//  月齢別の食事の進め方の目安（授乳・離乳の支援ガイドに沿った一般的な目安）
// ---------------------------------------------------------------------------
const STAGES = [
  { from: 5,  to: 6,  name: "離乳初期",   meals: 1, texture: "なめらかにすりつぶす", milk: "母乳・ミルクは欲しがるまま" },
  { from: 7,  to: 8,  name: "離乳中期",   meals: 2, texture: "舌でつぶせる固さ",     milk: "1日3回程度" },
  { from: 9,  to: 11, name: "離乳後期",   meals: 3, texture: "歯ぐきでつぶせる固さ", milk: "1日2回程度" },
  { from: 12, to: 18, name: "離乳完了期", meals: 3, texture: "歯ぐきで噛める固さ",   milk: "1日1〜2回・おやつ1〜2回" },
  { from: 19, to: 36, name: "幼児食",     meals: 3, texture: "大人よりやや柔らかく", milk: "牛乳など1日300〜400ml目安・おやつ1〜2回" },
];

// ---------------------------------------------------------------------------
//  在庫の保存場所ごとの日持ち目安（購入日から）— 期限未入力時の補完に使う
// ---------------------------------------------------------------------------
const SHELF_LIFE = { fridge: 4, freezer: 30, pantry: 14 };

window.BABY_DATA = {
  DRI, driKeyForMonths, FOODS, ALLERGENS, RECIPES,
  GROWTH, KAUP_BANDS, STAGES, SHELF_LIFE,
};
