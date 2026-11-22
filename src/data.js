/**
 * 『反則上等！』 (Hansoku Joto!) — Game Data & Roguelike Content Definitions
 *
 * Includes:
 * - STARTER_LOADOUTS: 3 distinct playable starter decks/styles
 * - ACTION_CARDS: 10+ action cards (including 'bare_punch' fallback) with Red Pen permanent rewrite options
 * - MOD_CARDS: 12+ modification cards with Red Pen permanent rewrite options
 * - FOUL_RULES: 10 equippable global foul rules
 * - ENEMY_TEMPLATES & AREA_ENCOUNTERS: 3 Areas of enemies, elites, and bosses
 * - MYSTERY_EVENTS & SHOP_CATALOG_HELPERS: Roguelike node progression content
 */

let _uidCounter = 1;
export function nextUid(prefix = 'uid') {
  return `${prefix}_${Date.now().toString(36)}_${(_uidCounter++).toString(36)}`;
}

// ============================================================================
// 1. ACTION CARDS (行動カード: 10種)
// ============================================================================

export const ACTION_CARDS = {
  bare_punch: {
    id: 'bare_punch',
    name: '素手パンチ',
    type: 'action',
    rarity: 'basic',
    isBasic: true,
    icon: '👊',
    color: '#94a3b8',
    baseDamage: 4,
    hits: 1,
    target: 'single',
    guardGain: 0,
    splashDamage: 0,
    explosionOnHit: 0,
    explosionOnKill: 0,
    guardDamageRatio: 0,
    missingHpDamageRatio: 0,
    description: '敵1体に4ダメージ。（行動カード未選択時でも常に発動可能！）',
    flavor: '「武器がねぇなら拳で語れ！」',
    redPenOptions: [
      {
        id: 'bp_all',
        label: '対象を『敵全員』に書き換え',
        oldText: '敵1体に',
        newText: '敵全員に',
        stamp: '全体化！',
        patch: { target: 'all', baseDamageBonus: 2 },
      },
      {
        id: 'bp_multi',
        label: '攻撃回数を+2回（3連発）に書き換え',
        oldText: '1回攻撃',
        newText: '3連発攻撃！',
        stamp: '3連殴り！',
        patch: { hitsBonus: 2 },
      },
      {
        id: 'bp_blast',
        label: '基本威力2倍＋命中時爆発3ダメージ',
        oldText: '4ダメージ',
        newText: '8ダメ＋爆発3！',
        stamp: '爆裂拳！',
        patch: { damageMultiplier: 2, explosionOnHitBonus: 3 },
      },
    ],
  },

  punch: {
    id: 'punch',
    name: '剛腕パンチ',
    type: 'action',
    rarity: 'common',
    isBasic: false,
    icon: '🥊',
    color: '#ef4444',
    baseDamage: 6,
    hits: 1,
    target: 'single',
    guardGain: 0,
    splashDamage: 0,
    explosionOnHit: 0,
    explosionOnKill: 0,
    guardDamageRatio: 0,
    missingHpDamageRatio: 0,
    description: '敵1体に6ダメージを与える王道の重い一撃。',
    flavor: '「校則第1条：殴られたら殴り返せ」',
    redPenOptions: [
      {
        id: 'punch_all',
        label: '対象を『敵全員』に書き換え',
        oldText: '敵1体に6ダメージ',
        newText: '敵全員に8ダメージ！',
        stamp: '全員殴打！',
        patch: { target: 'all', baseDamageBonus: 2 },
      },
      {
        id: 'punch_multi',
        label: '攻撃回数を+2回（3連発）に書き換え',
        oldText: '重い一撃',
        newText: '怒涛の3連発！',
        stamp: '3連剛腕！',
        patch: { hitsBonus: 2 },
      },
      {
        id: 'punch_heavy_blast',
        label: '基本威力を2倍＋命中時に全体爆発4ダメージ',
        oldText: '6ダメージ',
        newText: '12ダメ＋全体爆発4！',
        stamp: '反則爆拳！',
        patch: { damageMultiplier: 2, explosionOnHitBonus: 4 },
      },
    ],
  },

  gatling: {
    id: 'gatling',
    name: 'マシンガン連射',
    type: 'action',
    rarity: 'common',
    isBasic: false,
    icon: '💥',
    color: '#f59e0b',
    baseDamage: 3,
    hits: 3,
    target: 'single',
    guardGain: 0,
    splashDamage: 0,
    explosionOnHit: 0,
    explosionOnKill: 0,
    guardDamageRatio: 0,
    missingHpDamageRatio: 0,
    description: '敵1体に3ダメージ×3回。命中時効果や連撃ルールと相性抜群！',
    flavor: '「1発が軽いなら100発叩き込め！」',
    redPenOptions: [
      {
        id: 'gat_all',
        label: '対象を『敵全員』に書き換え',
        oldText: '敵1体に',
        newText: '敵全員に乱射！',
        stamp: '無差別乱射！',
        patch: { target: 'all' },
      },
      {
        id: 'gat_hits',
        label: '攻撃回数を3回→5回に書き換え',
        oldText: '×3回',
        newText: '×5回超連射！',
        stamp: '5連マシンガン！',
        patch: { hitsBonus: 2, baseDamageBonus: 1 },
      },
      {
        id: 'gat_blast',
        label: '基本威力+2＆命中ごとに全体爆発2ダメージ',
        oldText: '3ダメージ',
        newText: '5ダメ＋毎発爆発2！',
        stamp: '徹甲榴弾！',
        patch: { baseDamageBonus: 2, explosionOnHitBonus: 2 },
      },
    ],
  },

  beam: {
    id: 'beam',
    name: '反則レーザー',
    type: 'action',
    rarity: 'rare',
    isBasic: false,
    icon: '⚡',
    color: '#a855f7',
    baseDamage: 14,
    hits: 1,
    target: 'single',
    guardGain: 0,
    splashDamage: 0,
    explosionOnHit: 0,
    explosionOnKill: 0,
    guardDamageRatio: 0,
    missingHpDamageRatio: 0,
    armorPiercing: true,
    description: '敵1体に14ダメージ（アーマー貫通）。大振りや複数回攻撃と組むと即死級！',
    flavor: '「喧嘩に光学兵器を持ち込むのは反則？ 知らんな！」',
    redPenOptions: [
      {
        id: 'beam_all',
        label: '対象を『敵全員』に書き換え（なぎ払いレーザー）',
        oldText: '敵1体に14ダメージ',
        newText: '敵全員を14ダメで一掃！',
        stamp: '全方位照射！',
        patch: { target: 'all' },
      },
      {
        id: 'beam_multi',
        label: '攻撃回数を+1回（2連レーザー）に書き換え',
        oldText: '14ダメージ',
        newText: '14ダメージ×2連射！',
        stamp: '二連照射！',
        patch: { hitsBonus: 1 },
      },
      {
        id: 'beam_mega',
        label: '基本威力を1.8倍＋命中時全体爆発6ダメージ',
        oldText: '14ダメージ',
        newText: '25ダメ＋大爆発6！',
        stamp: '極太出力！',
        patch: { damageMultiplier: 1.8, explosionOnHitBonus: 6 },
      },
    ],
  },

  tackle: {
    id: 'tackle',
    name: '吹っ飛び突進',
    type: 'action',
    rarity: 'common',
    isBasic: false,
    icon: '🐗',
    color: '#f97316',
    baseDamage: 8,
    hits: 1,
    target: 'single',
    guardGain: 0,
    splashDamage: 4,
    explosionOnHit: 0,
    explosionOnKill: 0,
    guardDamageRatio: 0,
    missingHpDamageRatio: 0,
    description: '敵1体に8ダメージ＋激突ノックバック衝撃波で他の敵全員に4ダメージ！',
    flavor: '「前のヤツを盾にして後ろのヤツごと吹っ飛ばす！」',
    redPenOptions: [
      {
        id: 'tackle_all',
        label: '対象を『敵全員』に書き換え（全員に突進＋衝撃波）',
        oldText: '敵1体に8ダメージ',
        newText: '敵全員に8ダメ＋衝撃波！',
        stamp: '暴走機関車！',
        patch: { target: 'all', splashDamageBonus: 2 },
      },
      {
        id: 'tackle_multi',
        label: '攻撃回数を+2回（3連往復タックル）に書き換え',
        oldText: '8ダメージ',
        newText: '8ダメージ×3往復！',
        stamp: '往復ビンタ突進！',
        patch: { hitsBonus: 2 },
      },
      {
        id: 'tackle_shock',
        label: '基本ダメージ+5＆衝撃波ダメージを4→10に強化',
        oldText: '他の敵全員に4ダメージ',
        newText: '他全員に10ダメ大激震！',
        stamp: '大激突！',
        patch: { baseDamageBonus: 5, splashDamageBonus: 6 },
      },
    ],
  },

  guard_stance: {
    id: 'guard_stance',
    name: '鉄壁ガード',
    type: 'action',
    rarity: 'common',
    isBasic: false,
    icon: '🛡️',
    color: '#3b82f6',
    baseDamage: 0,
    hits: 1,
    target: 'single',
    guardGain: 12,
    splashDamage: 0,
    explosionOnHit: 0,
    explosionOnKill: 0,
    guardDamageRatio: 0.5,
    missingHpDamageRatio: 0,
    description: 'ガード+12を獲得し、さらに敵1体に現在のガード値の50%ダメージ！',
    flavor: '「守るだけじゃねぇ、盾の角で殴る！」',
    redPenOptions: [
      {
        id: 'gs_all',
        label: 'ガード+18に強化＆対象を『敵全員』に書き換え',
        oldText: 'ガード+12 / 敵1体',
        newText: 'ガード+18 / 敵全員！',
        stamp: '全面装甲衝撃！',
        patch: { guardGainBonus: 6, target: 'all' },
      },
      {
        id: 'gs_ratio',
        label: 'ガード獲得+16＆ガード値参照率を50%→120%に書き換え',
        oldText: 'ガード値の50%ダメージ',
        newText: 'ガード値の120%ダメージ！',
        stamp: '超重装甲砲！',
        patch: { guardGainBonus: 4, guardDamageRatioBonus: 0.7 },
      },
      {
        id: 'gs_multi',
        label: '攻撃回数を+2回（3連シールドバッシュ）に書き換え',
        oldText: '50%ダメージ',
        newText: '50%ダメージ×3連撃！',
        stamp: '3連盾殴り！',
        patch: { hitsBonus: 2, guardGainBonus: 4 },
      },
    ],
  },

  counter_stance: {
    id: 'counter_stance',
    name: '倍返しカウンター',
    type: 'action',
    rarity: 'uncommon',
    isBasic: false,
    icon: '💢',
    color: '#ec4899',
    baseDamage: 6,
    hits: 1,
    target: 'single',
    guardGain: 8,
    splashDamage: 0,
    explosionOnHit: 0,
    explosionOnKill: 0,
    guardDamageRatio: 0,
    missingHpDamageRatio: 0.5,
    description: 'ガード+8を獲得。敵1体に6ダメージ＋自身の減少HPの50%を追加ダメージ！',
    flavor: '「俺の流した血の分だけ、てめぇの骨が砕けるぜ！」',
    redPenOptions: [
      {
        id: 'cs_all',
        label: '対象を『敵全員』に書き換え＆ガード+12',
        oldText: '敵1体に',
        newText: '敵全員に怨念解放！',
        stamp: '全員道連れ！',
        patch: { target: 'all', guardGainBonus: 4 },
      },
      {
        id: 'cs_multi',
        label: '攻撃回数を+2回（3連倍返し）に書き換え',
        oldText: '6ダメージ',
        newText: '3連怨念カウンター！',
        stamp: '3倍返しだ！',
        patch: { hitsBonus: 2 },
      },
      {
        id: 'cs_ratio',
        label: '減少HPの追加ダメージ率を50%→120%＋基本威力+6',
        oldText: '減少HPの50%',
        newText: '減少HPの120%＋威力+6！',
        stamp: '100倍返し！',
        patch: { missingHpDamageRatioBonus: 0.7, baseDamageBonus: 6 },
      },
    ],
  },

  bomb_toss: {
    id: 'bomb_toss',
    name: 'ダイナマイト投擲',
    type: 'action',
    rarity: 'uncommon',
    isBasic: false,
    icon: '💣',
    color: '#eab308',
    baseDamage: 5,
    hits: 1,
    target: 'single',
    guardGain: 0,
    splashDamage: 0,
    explosionOnHit: 4,
    explosionOnKill: 0,
    guardDamageRatio: 0,
    missingHpDamageRatio: 0,
    description: '敵1体に5ダメージ＋命中時に敵全員へ4ダメージの爆発を起こす！',
    flavor: '「導火線が短すぎる？ 投げれば同じだ！」',
    redPenOptions: [
      {
        id: 'bt_all',
        label: '対象を『敵全員』に書き換え（敵の数だけ全体爆発！）',
        oldText: '敵1体に5ダメージ',
        newText: '敵全員に投擲＆全員起爆！',
        stamp: '絨毯爆撃！',
        patch: { target: 'all' },
      },
      {
        id: 'bt_multi',
        label: '攻撃回数を+2回（3連ダイナマイト）に書き換え',
        oldText: '5ダメージ',
        newText: '3連投擲＋3連爆発！',
        stamp: '3連爆弾魔！',
        patch: { hitsBonus: 2 },
      },
      {
        id: 'bt_nuke',
        label: '直撃ダメージ+5＆爆発ダメージを4→9に強化',
        oldText: '全体爆発4ダメージ',
        newText: '特大爆発9ダメージ！',
        stamp: '特大ニトロ！',
        patch: { baseDamageBonus: 5, explosionOnHitBonus: 5 },
      },
    ],
  },

  shield_slam: {
    id: 'shield_slam',
    name: 'シールドクラッシュ',
    type: 'action',
    rarity: 'uncommon',
    isBasic: false,
    icon: '🔰',
    color: '#06b6d4',
    baseDamage: 0,
    hits: 1,
    target: 'single',
    guardGain: 6,
    splashDamage: 0,
    explosionOnHit: 0,
    explosionOnKill: 0,
    guardDamageRatio: 1.0,
    missingHpDamageRatio: 0,
    description: 'ガード+6を獲得し、現在のガード値100%と同等のダメージを敵1体に叩き込む！',
    flavor: '「防御力＝攻撃力。これぞ反則の物理法則！」',
    redPenOptions: [
      {
        id: 'ss_all',
        label: '対象を『敵全員』に書き換え＆ガード+10',
        oldText: '敵1体に',
        newText: '敵全員に盾激突！',
        stamp: '全方位城壁！',
        patch: { target: 'all', guardGainBonus: 4 },
      },
      {
        id: 'ss_multi',
        label: '攻撃回数を+2回（3連シールドクラッシュ）に書き換え',
        oldText: '敵1体に与える',
        newText: '3連発で叩き潰す！',
        stamp: '3連城壁崩し！',
        patch: { hitsBonus: 2 },
      },
      {
        id: 'ss_double',
        label: 'ガード獲得+12＆ガード値の150%ダメージ＋命中爆発4',
        oldText: 'ガード値100%',
        newText: 'ガード150%＋爆発4！',
        stamp: '超重圧殺！',
        patch: { guardGainBonus: 6, guardDamageRatioBonus: 0.5, explosionOnHitBonus: 4 },
      },
    ],
  },

  guillotine: {
    id: 'guillotine',
    name: '処刑チョップ',
    type: 'action',
    rarity: 'rare',
    isBasic: false,
    icon: '🪓',
    color: '#dc2626',
    baseDamage: 10,
    hits: 1,
    target: 'single',
    guardGain: 0,
    splashDamage: 0,
    explosionOnHit: 0,
    explosionOnKill: 8,
    guardDamageRatio: 0,
    missingHpDamageRatio: 0,
    description: '敵1体に10ダメージ。これで敵を倒すと即座に全体爆発8ダメージ！',
    flavor: '「首が飛べば花火が上がるぜ！」',
    redPenOptions: [
      {
        id: 'gui_all',
        label: '対象を『敵全員』に書き換え（全員処刑チョップ！）',
        oldText: '敵1体に10ダメージ',
        newText: '敵全員に10ダメージ！',
        stamp: '一斉処刑！',
        patch: { target: 'all' },
      },
      {
        id: 'gui_multi',
        label: '攻撃回数を+2回（3連処刑チョップ）に書き換え',
        oldText: '10ダメージ',
        newText: '10ダメージ×3連斬り！',
        stamp: '3連断頭台！',
        patch: { hitsBonus: 2 },
      },
      {
        id: 'gui_nuke',
        label: '基本威力1.8倍＆撃破時爆発を8→16ダメージに強化',
        oldText: '全体爆発8ダメージ',
        newText: '威力18＋撃破爆発16！',
        stamp: '極刑大爆発！',
        patch: { damageMultiplier: 1.8, explosionOnKillBonus: 8 },
      },
    ],
  },
};

// ============================================================================
// 2. MODIFICATION CARDS (魔改造カード: 12種)
// ============================================================================

export const MOD_CARDS = {
  triple_hit: {
    id: 'triple_hit',
    name: '3連発',
    type: 'mod',
    rarity: 'common',
    icon: '×3',
    color: '#f59e0b',
    hitsAdd: 2,
    damageMultiplier: 1,
    damageAdd: 0,
    description: '攻撃回数を+2回増やす（単発技なら3連発化！）。',
    flavor: '「1回しか殴っちゃダメなんて誰が決めた？」',
    redPenOptions: [
      {
        id: 'th_five',
        label: '攻撃回数+2 → 攻撃回数+4（5連発化！）',
        oldText: '攻撃回数を+2回',
        newText: '攻撃回数を+4回（5連発）！',
        stamp: '5連発化！',
        patch: { hitsAddBonus: 2 },
      },
      {
        id: 'th_blast',
        label: 'さらに命中時全体爆発+3ダメージを付与',
        oldText: '増やす',
        newText: '増やし、毎発全体爆発3！',
        stamp: '+連撃爆薬！',
        patch: { explosionOnHitAdd: 3 },
      },
      {
        id: 'th_power',
        label: 'さらに基本威力1.5倍を付与',
        oldText: '+2回増やす',
        newText: '+2回＆威力1.5倍！',
        stamp: '+高速重撃！',
        patch: { damageMultiplierBonus: 0.5 },
      },
    ],
  },

  heavy_swing: {
    id: 'heavy_swing',
    name: '大振り',
    type: 'mod',
    rarity: 'common',
    icon: '🔨',
    color: '#ef4444',
    hitsAdd: 0,
    damageMultiplier: 2.5,
    damageAdd: 0,
    description: '基本ダメージを2.5倍に跳ね上げる！',
    flavor: '「当たるかどうかなんて知らん、当たれば粉砕だ！」',
    redPenOptions: [
      {
        id: 'hs_quad',
        label: '倍率を2.5倍 → 4.0倍に書き換え！',
        oldText: '2.5倍',
        newText: '超反則4.0倍！',
        stamp: '4倍粉砕！',
        patch: { damageMultiplierBonus: 1.5 },
      },
      {
        id: 'hs_blast',
        label: 'さらに命中時に全体爆発6ダメージを付与',
        oldText: '跳ね上げる！',
        newText: '2.5倍＋全体爆発6！',
        stamp: '+余波爆発！',
        patch: { explosionOnHitAdd: 6 },
      },
      {
        id: 'hs_extra_hit',
        label: 'さらに攻撃回数+1回を付与',
        oldText: '2.5倍に',
        newText: '2.5倍＆攻撃回数+1回！',
        stamp: '+二段大振り！',
        patch: { hitsAddBonus: 1 },
      },
    ],
  },

  share_all: {
    id: 'share_all',
    name: 'おすそわけ',
    type: 'mod',
    rarity: 'uncommon',
    icon: '📢',
    color: '#10b981',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 0,
    overrideTarget: 'all',
    description: '攻撃対象を「敵全員」に変更する！単体高火力技や連撃技が一気に全体殲滅兵器へ！',
    flavor: '「遠慮すんな、全員に同じだけ喰らわせてやるよ！」',
    redPenOptions: [
      {
        id: 'sa_power',
        label: '全体化に加え、さらに基本威力1.6倍を付与',
        oldText: '「敵全員」に変更する',
        newText: '「敵全員」＆威力1.6倍！',
        stamp: '+大盤振る舞い！',
        patch: { damageMultiplierBonus: 0.6 },
      },
      {
        id: 'sa_hits',
        label: '全体化に加え、さらに攻撃回数+1回を付与',
        oldText: '変更する！',
        newText: '変更＆攻撃回数+1回！',
        stamp: '+二巡配布！',
        patch: { hitsAddBonus: 1 },
      },
      {
        id: 'sa_blast',
        label: '全体化に加え、さらに命中時全体爆発+3ダメージを付与',
        oldText: '全体殲滅兵器へ！',
        newText: '命中ごとに全体爆発3！',
        stamp: '+連鎖おすそわけ！',
        patch: { explosionOnHitAdd: 3 },
      },
    ],
  },

  induce_explosion: {
    id: 'induce_explosion',
    name: '誘爆',
    type: 'mod',
    rarity: 'common',
    icon: '🧨',
    color: '#f97316',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 0,
    explosionOnHitAdd: 3,
    description: '攻撃が命中するたび、敵全員に3ダメージの連鎖爆発を発生させる！',
    flavor: '「殴った場所から火柱が上がる。科学じゃなくて気合だ！」',
    redPenOptions: [
      {
        id: 'ie_big',
        label: '誘爆ダメージを3 → 7ダメージに書き換え！',
        oldText: '3ダメージの連鎖爆発',
        newText: '7ダメージの大連鎖爆発！',
        stamp: '大誘爆7！',
        patch: { explosionOnHitAddBonus: 4 },
      },
      {
        id: 'ie_hits',
        label: 'さらに攻撃回数+2回を付与（自分で3連誘爆！）',
        oldText: '命中するたび',
        newText: '回数+2回＆命中ごと爆発！',
        stamp: '+3連起爆！',
        patch: { hitsAddBonus: 2 },
      },
      {
        id: 'ie_kill',
        label: 'さらに敵撃破時に全体爆発10ダメージを追加',
        oldText: '発生させる！',
        newText: '発生＋撃破時10ダメ大爆発！',
        stamp: '+死体誘爆！',
        patch: { explosionOnKillAdd: 10 },
      },
    ],
  },

  encore: {
    id: 'encore',
    name: 'おかわり',
    type: 'mod',
    rarity: 'uncommon',
    icon: '🍚',
    color: '#ec4899',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 2,
    encoreOnKill: true,
    encoreCount: 1,
    description: '威力+2。敵を倒した際、生存している別の敵に同じ攻撃セットを丸ごと追加発動する！',
    flavor: '「1人倒したら終わり？ いやいや、ここからがおかわりだ！」',
    redPenOptions: [
      {
        id: 'enc_double',
        label: '撃破時の追加発動を2回分（山盛りおかわり）＆威力+5に強化',
        oldText: '同じ攻撃セットを丸ごと追加発動',
        newText: '威力+7＆撃破時2連続おかわり！',
        stamp: '特盛おかわり！',
        patch: { encoreCountBonus: 1, damageAddBonus: 5 },
      },
      {
        id: 'enc_power',
        label: 'さらに基本ダメージ1.8倍を付与（確実に仕留めて連鎖！）',
        oldText: '威力+2',
        newText: '威力1.8倍でおかわり確定！',
        stamp: '+確殺おかわり！',
        patch: { damageMultiplierBonus: 0.8 },
      },
      {
        id: 'enc_hits',
        label: 'さらに攻撃回数+1回＆命中爆発2ダメージを付与',
        oldText: '追加発動する！',
        newText: '回数+1＆爆発2＆おかわり！',
        stamp: '+連撃おかわり！',
        patch: { hitsAddBonus: 1, explosionOnHitAdd: 2 },
      },
    ],
  },

  insurance: {
    id: 'insurance',
    name: '保険',
    type: 'mod',
    rarity: 'common',
    icon: '🛡️',
    color: '#3b82f6',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 0,
    guardOnHit: 4,
    description: '攻撃が命中するたび、プレイヤーはガード+4を獲得する！多段攻撃で鉄壁要塞化！',
    flavor: '「殴りながら保険金を積み立てる。健全な不良の嗜みだ」',
    redPenOptions: [
      {
        id: 'ins_big',
        label: '命中ごとのガード獲得を+4 → +9に書き換え！',
        oldText: 'ガード+4',
        newText: '毎発ガード+9獲得！',
        stamp: '満額保険+9！',
        patch: { guardOnHitBonus: 5 },
      },
      {
        id: 'ins_hits',
        label: 'さらに攻撃回数+2回を付与（3連ガード積み立て）',
        oldText: '命中するたび',
        newText: '回数+2回＆毎発ガード+4！',
        stamp: '+3連積立！',
        patch: { hitsAddBonus: 2 },
      },
      {
        id: 'ins_slam',
        label: 'さらに現在のガード値の50%を攻撃威力に加算',
        oldText: '獲得する！',
        newText: '獲得＋ガード50%を威力加算！',
        stamp: '+攻性保険！',
        patch: { addGuardRatioToDamage: 0.5 },
      },
    ],
  },

  payback: {
    id: 'payback',
    name: '倍返し',
    type: 'mod',
    rarity: 'uncommon',
    icon: '🔥',
    color: '#e11d48',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 0,
    paybackMode: true,
    paybackMinBonus: 5,
    paybackMultiplier: 1.0,
    description: '直前のターン以降に受けた累計被ダメージ（最低+5）を1発ごとの攻撃威力に加算する！',
    flavor: '「やられた分はきっちり帳面に付けてあるぜ！」',
    redPenOptions: [
      {
        id: 'pb_double',
        label: '受けたダメージの200%（最低+10）を威力に加算！',
        oldText: '累計被ダメージ（最低+5）',
        newText: '被ダメの200%（最低+10）加算！',
        stamp: '倍返し200%！',
        patch: { paybackMinBonusAdd: 5, paybackMultiplierBonus: 1.0 },
      },
      {
        id: 'pb_hits',
        label: 'さらに攻撃回数+2回を付与（全段に倍返しボーナスが乗る！）',
        oldText: '攻撃威力に加算',
        newText: '回数+2回＆全段に倍返し加算！',
        stamp: '+3連倍返し！',
        patch: { hitsAddBonus: 2 },
      },
      {
        id: 'pb_all',
        label: 'さらに対象を『敵全員』に変更',
        oldText: '加算する！',
        newText: '加算し、敵全員に叩き込む！',
        stamp: '+八つ当たり全体化！',
        patch: { overrideTarget: 'all' },
      },
    ],
  },

  low_hp_bonus: {
    id: 'low_hp_bonus',
    name: '瀕死ボーナス',
    type: 'mod',
    rarity: 'uncommon',
    icon: '💀',
    color: '#9333ea',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 0,
    lowHpScaling: true,
    maxLowHpMultiplier: 3.0,
    description: '対象（または自身）の残りHP割合が低いほど威力倍増（最大3.0倍）！',
    flavor: '「弱った獲物と追い詰められた番長が一番おっかねぇ！」',
    redPenOptions: [
      {
        id: 'lhb_max',
        label: '最大倍率を3.0倍 → 5.0倍（最低でも2.0倍保証）に書き換え！',
        oldText: '最大3.0倍',
        newText: '最低2倍〜最大5.0倍！',
        stamp: '処刑5倍！',
        patch: { maxLowHpMultiplierBonus: 2.0, minLowHpMultiplier: 2.0 },
      },
      {
        id: 'lhb_hits',
        label: 'さらに攻撃回数+2回を付与',
        oldText: '威力倍増',
        newText: '回数+2回＆瀕死威力倍増！',
        stamp: '+追い討ち3連！',
        patch: { hitsAddBonus: 2 },
      },
      {
        id: 'lhb_kill_blast',
        label: 'さらに敵撃破時に全体爆発12ダメージを付与',
        oldText: '（最大3.0倍）！',
        newText: '最大3倍＋撃破時全体爆発12！',
        stamp: '+断末魔爆破！',
        patch: { explosionOnKillAdd: 12 },
      },
    ],
  },

  vampire: {
    id: 'vampire',
    name: 'ドレイン改変',
    type: 'mod',
    rarity: 'rare',
    icon: '🧛',
    color: '#be123c',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 2,
    healOnHit: 1,
    healOnKill: 5,
    description: '威力+2。攻撃命中ごとにHP1回復、敵を撃破するたびHPを5回復する！',
    flavor: '「相手の元気をカツアゲして自分の体力にする！」',
    redPenOptions: [
      {
        id: 'vamp_feast',
        label: '命中回復を1→3、撃破回復を5→10、威力+5に書き換え！',
        oldText: '命中ごとにHP1回復、敵を撃破するたびHPを5回復',
        newText: '威力+5＆命中HP3・撃破HP10回復！',
        stamp: '超カツアゲ吸収！',
        patch: { healOnHitBonus: 2, healOnKillBonus: 5, damageAddBonus: 3 },
      },
      {
        id: 'vamp_hits',
        label: 'さらに攻撃回数+2回を付与（多段ヒットで超回復！）',
        oldText: '威力+2。',
        newText: '威力+2＆攻撃回数+2回！',
        stamp: '+連撃吸収！',
        patch: { hitsAddBonus: 2 },
      },
      {
        id: 'vamp_all',
        label: 'さらに対象を『敵全員』に変更（全員からHP吸収！）',
        oldText: 'HPを5回復する！',
        newText: '対象を敵全員化＆全員から吸収！',
        stamp: '+全体カツアゲ！',
        patch: { overrideTarget: 'all' },
      },
    ],
  },

  armor_crush: {
    id: 'armor_crush',
    name: '装甲破壊',
    type: 'mod',
    rarity: 'uncommon',
    icon: '🔩',
    color: '#64748b',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 3,
    pierceArmor: true,
    vulnOnHit: 3,
    description: '威力+3。敵のダメージ軽減を完全貫通し、命中ごとに敵の被ダメージを永続+3増加（脆弱付与）！',
    flavor: '「カチカチの審判も、装甲を剥がせばただのサンドバッグだ！」',
    redPenOptions: [
      {
        id: 'ac_shatter',
        label: '脆弱付与を+3 → +6に倍増＆基本威力+6に書き換え！',
        oldText: '被ダメージを永続+3増加',
        newText: '威力+6＆毎発被ダメ+6増加！',
        stamp: '完全装甲粉砕！',
        patch: { vulnOnHitBonus: 3, damageAddBonus: 3 },
      },
      {
        id: 'ac_hits',
        label: 'さらに攻撃回数+2回を付与（1発目から脆弱が重なる！）',
        oldText: '完全貫通し',
        newText: '回数+2回＆完全貫通＋脆弱累積！',
        stamp: '+3連削岩！',
        patch: { hitsAddBonus: 2 },
      },
      {
        id: 'ac_blast',
        label: 'さらに命中ごとに全体爆発4ダメージを付与',
        oldText: '（脆弱付与）！',
        newText: '脆弱付与＋毎発全体爆発4！',
        stamp: '+破片爆散！',
        patch: { explosionOnHitAdd: 4 },
      },
    ],
  },

  double_cast: {
    id: 'double_cast',
    name: '二重詠唱',
    type: 'mod',
    rarity: 'rare',
    icon: '♊',
    color: '#8b5cf6',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 0,
    repeatCastAdd: 1,
    description: 'このコンボの発射全体を2回連続で実行する！（ガード獲得も連撃も全部2回発動！）',
    flavor: '「1ターンに1回しか行動できない？ 時計の針を殴って戻せば2回だ！」',
    redPenOptions: [
      {
        id: 'dc_triple',
        label: '2回連続 → 3回連続実行（三重詠唱）に書き換え！',
        oldText: '2回連続で実行',
        newText: '3回連続で実行（三重詠唱）！',
        stamp: '三重詠唱化！',
        patch: { repeatCastAddBonus: 1 },
      },
      {
        id: 'dc_power',
        label: 'さらに基本ダメージ1.5倍を付与',
        oldText: '実行する！',
        newText: '威力1.5倍で2回連続実行！',
        stamp: '+強化二重発動！',
        patch: { damageMultiplierBonus: 0.5 },
      },
      {
        id: 'dc_blast',
        label: 'さらに命中ごとに全体爆発3ダメージを付与',
        oldText: '2回連続',
        newText: '毎発爆発3付きで2回連続！',
        stamp: '+二重爆撃！',
        patch: { explosionOnHitAdd: 3 },
      },
    ],
  },

  guard_convert: {
    id: 'guard_convert',
    name: '攻防一体',
    type: 'mod',
    rarity: 'rare',
    icon: '☯️',
    color: '#0ea5e9',
    hitsAdd: 0,
    damageMultiplier: 1,
    damageAdd: 0,
    guardGainOnCast: 6,
    addGuardRatioToDamage: 1.0,
    description: '発動時にガード+6を獲得し、現在のガード値100%を全ヒットの基本ダメージに加算する！',
    flavor: '「守りを固めれば固めるほど、拳が鉛のように重くなる！」',
    redPenOptions: [
      {
        id: 'gc_overdrive',
        label: '発動時ガード+12＆ガード値の150%を基本ダメージに加算！',
        oldText: 'ガード+6を獲得し、現在のガード値100%',
        newText: 'ガード+12＆ガード値150%加算！',
        stamp: '超攻防一体150%！',
        patch: { guardGainOnCastBonus: 6, addGuardRatioToDamageBonus: 0.5 },
      },
      {
        id: 'gc_hits',
        label: 'さらに攻撃回数+2回を付与（全ヒットにガード値が乗る！）',
        oldText: '全ヒットの基本ダメージ',
        newText: '回数+2回＆全段にガード値加算！',
        stamp: '+3連要塞拳！',
        patch: { hitsAddBonus: 2 },
      },
      {
        id: 'gc_all',
        label: 'さらに対象を『敵全員』に変更',
        oldText: '加算する！',
        newText: '加算し、敵全員を薙ぎ払う！',
        stamp: '+全体城壁砲！',
        patch: { overrideTarget: 'all' },
      },
    ],
  },
};

// ============================================================================
// 3. FOUL RULES (反則ルール: 10種 - 常時発動パッシブ)
// ============================================================================

export const FOUL_RULES = {
  death_chain: {
    id: 'death_chain',
    name: '死体爆弾ルール',
    icon: '💀',
    color: '#ef4444',
    price: 55,
    description: '敵が死亡するたび、生存する敵全員に7ダメージの連鎖爆発を起こす！',
    shortDesc: '敵撃破時 → 全体7ダメ爆発',
  },
  blast_shield: {
    id: 'blast_shield',
    name: '爆風バリア',
    icon: '🛡️',
    color: '#3b82f6',
    price: 50,
    description: '爆発が発生するたび、プレイヤーはガード+3を獲得する！',
    shortDesc: '爆発発生時 → ガード+3獲得',
  },
  chain_scaling: {
    id: 'chain_scaling',
    name: '連撃インフレ',
    icon: '📈',
    color: '#f59e0b',
    price: 60,
    description: '同一ターン中に攻撃や爆発が命中するたび、そのターンの全ダメージが+2ずつ上昇する！',
    shortDesc: '命中ごと → ターン中全威力+2',
  },
  crisis_fury: {
    id: 'crisis_fury',
    name: '火事場の反則力',
    icon: '🔥',
    color: '#dc2626',
    price: 55,
    description: 'プレイヤーのHPが50%以下のとき、すべての攻撃回数が+1回され威力が1.5倍になる！',
    shortDesc: 'HP50%以下 → 攻撃回数+1＆威力1.5倍',
  },
  first_blood_nuke: {
    id: 'first_blood_nuke',
    name: '見せしめ大爆発',
    icon: '💥',
    color: '#f97316',
    price: 50,
    description: '各ターン最初に撃破した敵が、敵全員に12ダメージの特大爆発を起こす！',
    shortDesc: 'ターン初撃破 → 全体12ダメ特大爆発',
  },
  overkill_transfer: {
    id: 'overkill_transfer',
    name: '余剰ダメージ転嫁',
    icon: '⚡',
    color: '#a855f7',
    price: 65,
    description: '敵の残りHPを超えた余剰ダメージの100%を、生存している別の敵に雷撃として叩き込む！',
    shortDesc: 'オーバーキル分100% → 別の敵へ雷撃連鎖',
  },
  thorns_revenge: {
    id: 'thorns_revenge',
    name: '反則スパイク装甲',
    icon: '🌵',
    color: '#10b981',
    price: 55,
    description: '敵から攻撃を受けるたび、攻撃してきた敵に8ダメージ＋全体爆発4ダメージを返す！',
    shortDesc: '被弾時 → 敵に8ダメ＋全体4ダメ爆発',
  },
  guard_artillery: {
    id: 'guard_artillery',
    name: '要塞砲撃ルール',
    icon: '🏰',
    color: '#06b6d4',
    price: 65,
    description: 'ガードを獲得するたび、ランダムな敵に獲得量の100%の砲撃ダメージを与える！',
    shortDesc: 'ガード獲得時 → 獲得量100%の砲撃ダメ',
  },
  combo_jackpot: {
    id: 'combo_jackpot',
    name: '10連鎖ジャックポット',
    icon: '🎰',
    color: '#eab308',
    price: 70,
    description: '1ターンの連鎖数が10の倍数に達するたび、敵全員に15ダメージ＆ゴールド+15G獲得！',
    shortDesc: '10連鎖ごと → 全体15ダメ＆+15G',
  },
  blood_alchemy: {
    id: 'blood_alchemy',
    name: '暴走アドレナリン',
    icon: '💉',
    color: '#ec4899',
    price: 60,
    description: '敵を撃破するたび、HPを3回復しその戦闘中の基礎攻撃力が永続+2される！',
    shortDesc: '敵撃破時 → HP3回復＆戦闘中威力+2',
  },
};

// ============================================================================
// 4. STARTER LOADOUTS (初期スタイル: 3種)
// ============================================================================

export const STARTER_LOADOUTS = {
  brawler: {
    id: 'brawler',
    name: '反則番長・爆発スタイル',
    subtitle: '連撃×誘爆×死体爆弾で画面ごと吹き飛ばす王道爽快スタイル！',
    icon: '💥',
    color: '#ef4444',
    maxHp: 80,
    startingGold: 60,
    startingRedPens: 1,
    startingRule: 'death_chain',
    actionCards: ['punch', 'punch', 'tackle', 'bomb_toss', 'guillotine'],
    modCards: ['triple_hit', 'induce_explosion', 'heavy_swing', 'share_all', 'encore'],
  },
  speedster: {
    id: 'speedster',
    name: '超連打マシンガンスタイル',
    subtitle: '手数で圧倒！1ヒットごとに威力がインフレする超高速多段コンボ！',
    icon: '⚡',
    color: '#f59e0b',
    maxHp: 75,
    startingGold: 65,
    startingRedPens: 1,
    startingRule: 'chain_scaling',
    actionCards: ['gatling', 'gatling', 'punch', 'beam', 'tackle'],
    modCards: ['triple_hit', 'triple_hit', 'encore', 'armor_crush', 'double_cast'],
  },
  fortress: {
    id: 'fortress',
    name: '鉄壁倍返しカウンタースタイル',
    subtitle: 'ガードを積むほど砲撃が飛び、防御力をそのまま超火力に変換する不沈艦！',
    icon: '🛡️',
    color: '#3b82f6',
    maxHp: 90,
    startingGold: 60,
    startingRedPens: 1,
    startingRule: 'guard_artillery',
    actionCards: ['guard_stance', 'shield_slam', 'counter_stance', 'punch', 'bomb_toss'],
    modCards: ['insurance', 'guard_convert', 'payback', 'heavy_swing', 'induce_explosion'],
  },
};

// ============================================================================
// 5. ENEMY TEMPLATES & AREA ENCOUNTERS (敵データ＆3エリア構成)
// ============================================================================

export const ENEMY_TEMPLATES = {
  sandbag_jr: {
    id: 'sandbag_jr',
    name: '練習用サンドバッグ',
    subtitle: '殴られ専門',
    modelType: 'sandbag',
    color: '#d97706',
    accentColor: '#fbbf24',
    scale: 0.95,
    maxHp: 18,
    armor: 0,
    passiveName: 'サンドバッグ魂',
    passiveDesc: '特別な耐性なし。思いっきり反則コンボを叩き込もう！',
    intents: [
      { type: 'attack', damage: 5, label: '体当たり (5)' },
      { type: 'attack', damage: 7, label: 'スイング (7)' },
    ],
  },

  mini_encore: {
    id: 'mini_encore',
    name: 'ミニおかわり',
    subtitle: '分裂体',
    modelType: 'slime',
    color: '#34d399',
    accentColor: '#a7f3d0',
    scale: 0.7,
    maxHp: 12,
    armor: 0,
    passiveName: '連鎖の餌食',
    passiveDesc: 'HPが低く、『おかわり』や『死体爆弾ルール』の絶好の起爆剤になる！',
    intents: [
      { type: 'attack', damage: 4, label: 'ぷるぷる突撃 (4)' },
    ],
  },

  hard_referee: {
    id: 'hard_referee',
    name: 'カチカチ審判',
    subtitle: '鉄壁の校則主義者',
    modelType: 'referee',
    color: '#475569',
    accentColor: '#94a3b8',
    scale: 1.05,
    maxHp: 28,
    armor: 3,
    passiveName: '鉄板プロテクター',
    passiveDesc: '受ける直接ダメージを毎回3軽減する。大振り一撃や『装甲破壊』、爆発が有効！',
    intents: [
      { type: 'attack', damage: 7, label: '警棒スイング (7)' },
      { type: 'guard_buff', armorAdd: 1, damage: 5, label: '装甲強化＋殴打 (5)' },
    ],
  },

  counter_punk: {
    id: 'counter_punk',
    name: 'やり返し君',
    subtitle: '瞬間湯沸かし器',
    modelType: 'punk',
    color: '#e11d48',
    accentColor: '#fda4af',
    scale: 1.0,
    maxHp: 26,
    armor: 0,
    counterDamage: 3,
    passiveName: '即座にやり返す',
    passiveDesc: '生存中に直接攻撃を受けるたび、即座にプレイヤーへ3ダメージの反撃！ガードや一撃必殺、爆発巻き込みが有効。',
    intents: [
      { type: 'attack', damage: 6, label: '喧嘩キック (6)' },
      { type: 'attack', damage: 8, label: '頭突き (8)' },
    ],
  },

  bomber_man: {
    id: 'bomber_man',
    name: 'ボンバーマン',
    subtitle: '歩く火薬庫',
    modelType: 'bomber',
    color: '#ea580c',
    accentColor: '#fde047',
    scale: 1.0,
    maxHp: 20,
    armor: 0,
    deathExplosionEnemyDamage: 8,
    deathExplosionPlayerDamage: 3,
    passiveName: '道連れ火薬樽',
    passiveDesc: '撃破されると即座に大爆発！敵全員に8ダメージ（プレイヤーに3ダメージ）を与える最高の起爆剤！',
    intents: [
      { type: 'attack', damage: 6, label: '火薬パンチ (6)' },
      { type: 'attack', damage: 9, label: '自爆突撃 (9)' },
    ],
  },

  encore_slime: {
    id: 'encore_slime',
    name: 'おかわり君',
    subtitle: '無限増殖スライム',
    modelType: 'slime',
    color: '#10b981',
    accentColor: '#6ee7b7',
    scale: 1.1,
    maxHp: 34,
    armor: 0,
    summonOnTurnEnd: 'mini_encore',
    passiveName: '毎ターン分裂',
    passiveDesc: '敵ターンに行動するとHP12の『ミニおかわり』を召喚する。全体攻撃や撃破連鎖のカモにせよ！',
    intents: [
      { type: 'summon_attack', damage: 6, summonId: 'mini_encore', label: '分裂＆粘液弾 (6＋召喚)' },
      { type: 'attack', damage: 8, label: '大波アタック (8)' },
    ],
  },

  giant_sandbag: {
    id: 'giant_sandbag',
    name: '巨大サンドバッグ',
    subtitle: '超重量級ヘビーバッグ',
    modelType: 'giant_sandbag',
    color: '#b45309',
    accentColor: '#f59e0b',
    scale: 1.45,
    maxHp: 95,
    armor: 0,
    isElite: true,
    passiveName: '3ターン後の大崩壊',
    passiveDesc: '超高HP！2ターン溜めたあと、3ターン目に30ダメージの特大プレスを放つ。それまでに超火力コンボで削り切れ！',
    intents: [
      { type: 'charge', damage: 0, label: '大きく揺れている… (溜め1/2)' },
      { type: 'charge', damage: 6, label: '鎖が軋む！小衝撃 (6・溜め2/2)' },
      { type: 'mega_attack', damage: 30, label: '⚠️超重プレス！！ (30ダメージ)' },
    ],
  },

  whistle_enforcer: {
    id: 'whistle_enforcer',
    name: 'ホイッスル看守',
    subtitle: '反則取締エリート',
    modelType: 'enforcer',
    color: '#6366f1',
    accentColor: '#c7d2fe',
    scale: 1.35,
    maxHp: 115,
    armor: 2,
    isElite: true,
    passiveName: '取締強化ホイッスル',
    passiveDesc: 'アーマー2持ち。高威力攻撃と仲間呼び・攻撃力強化を使うエリア中ボス！',
    intents: [
      { type: 'attack', damage: 11, label: '電磁警棒フルスイング (11)' },
      { type: 'summon_attack', damage: 8, summonId: 'bomber_man', label: '増援要請＆威嚇射撃 (8＋ボンバー召喚)' },
      { type: 'multi_attack', damage: 6, hits: 2, label: '二連制裁ビート (6×2回)' },
    ],
  },

  chief_referee: {
    id: 'chief_referee',
    name: '絶対審判長・ジャッジマン',
    subtitle: 'FINAL BOSS・反則絶対許さないマン',
    modelType: 'boss_judge',
    color: '#dc2626',
    accentColor: '#fef08a',
    scale: 1.75,
    maxHp: 280,
    armor: 2,
    isBoss: true,
    bossCounterEveryHits: 3,
    bossCounterDamage: 5,
    passiveName: '絶対審判レーザー＆強制退場宣告',
    passiveDesc: '直接攻撃を3回受けるごとに5ダメージの反撃レーザーを発射！取り巻き召喚とカウントダウン超必殺技を持つが、完成した反則コンボなら一気に吹き飛ばせる！',
    intents: [
      { type: 'summon_attack', damage: 10, summonId: 'bomber_man', label: '審判執行＆火薬樽投下 (10＋ボンバー召喚)' },
      { type: 'multi_attack', damage: 7, hits: 2, label: '二連レッドカード斬り (7×2回)' },
      { type: 'charge', damage: 8, label: '⚠️退場宣告チャージ！ (8＋次ターン超必殺)' },
      { type: 'mega_attack', damage: 36, label: '🚨超必殺・校則第零条ジェノサイド (36ダメージ)' },
    ],
  },
};

export const AREA_CONFIGS = {
  1: {
    area: 1,
    name: 'AREA 1：反則校庭・裏路地',
    subtitle: 'まずは基本の連撃と爆発でサンドバッグどもを吹き飛ばせ！',
    themeColor: '#f97316',
    hpScale: 1.0,
    dmgScale: 1.0,
    normalPools: [
      ['sandbag_jr', 'sandbag_jr'],
      ['sandbag_jr', 'bomber_man', 'sandbag_jr'],
      ['hard_referee', 'sandbag_jr'],
    ],
    elitePools: [
      ['giant_sandbag', 'bomber_man'],
      ['hard_referee', 'bomber_man', 'counter_punk'],
    ],
    bossPool: ['giant_sandbag', 'bomber_man', 'sandbag_jr'],
    bossTitle: 'エリア1番長戦：暴走巨大サンドバッグ軍団',
  },
  2: {
    area: 2,
    name: 'AREA 2：鉄壁風紀委員・検問所',
    subtitle: 'カチカチ審判ややり返し君が登場！魔改造と赤ペンでルールを破壊せよ！',
    themeColor: '#3b82f6',
    hpScale: 1.15,
    dmgScale: 1.1,
    normalPools: [
      ['hard_referee', 'bomber_man', 'sandbag_jr'],
      ['counter_punk', 'bomber_man', 'counter_punk'],
      ['encore_slime', 'hard_referee'],
    ],
    elitePools: [
      ['whistle_enforcer', 'bomber_man'],
      ['giant_sandbag', 'encore_slime'],
    ],
    bossPool: ['whistle_enforcer', 'hard_referee', 'bomber_man'],
    bossTitle: 'エリア2中ボス戦：ホイッスル看守＆鉄壁審判隊',
  },
  3: {
    area: 3,
    name: 'AREA 3：絶対審判長・大闘技場',
    subtitle: '全ての反則ルールと赤ペン魔改造を解放し、絶対審判長をワンターン撃破せよ！',
    themeColor: '#dc2626',
    hpScale: 1.25,
    dmgScale: 1.2,
    normalPools: [
      ['hard_referee', 'counter_punk', 'bomber_man'],
      ['encore_slime', 'bomber_man', 'counter_punk'],
      ['hard_referee', 'encore_slime', 'hard_referee'],
    ],
    elitePools: [
      ['whistle_enforcer', 'counter_punk', 'bomber_man'],
      ['giant_sandbag', 'hard_referee', 'bomber_man'],
    ],
    bossPool: ['chief_referee', 'bomber_man', 'mini_encore'],
    bossTitle: 'FINAL BOSS：絶対審判長・ジャッジマン',
  },
};

export const AREA_ENCOUNTERS = AREA_CONFIGS;

// ============================================================================
// 6. MYSTERY EVENTS (ランダムイベント: 5種)
// ============================================================================

export const MYSTERY_EVENTS = [
  {
    id: 'red_pen_master',
    title: '伝説の赤ペン先生・乱入！',
    icon: '🖍️',
    description:
      '怪しい白衣の先生が赤い極太マジックを差し出してきた。「君のカード、もっと反則に書き換えてあげようか？」',
    choices: [
      {
        id: 'get_pens',
        label: '赤ペンを2本もらう（赤ペン+2）',
        effectDesc: '赤ペン+2本獲得！',
        effect: { redPens: 2 },
      },
      {
        id: 'pen_and_heal',
        label: '赤ペン1本と救急箱をもらう（赤ペン+1・HP25回復）',
        effectDesc: '赤ペン+1本＆HP25回復！',
        effect: { redPens: 1, heal: 25 },
      },
    ],
  },
  {
    id: 'illegal_slot_machine',
    title: '裏路地の反則スロットマシン',
    icon: '🎰',
    description:
      '火花を散らす違法改造スロットマシンが置かれている。レバーを殴れば大金か反則パーツが飛び出すらしい！',
    choices: [
      {
        id: 'smash_machine',
        label: '全力で殴り壊す（HP-10・ゴールド+85G・赤ペン+1）',
        effectDesc: 'HPを10消費して85G＆赤ペン+1獲得！',
        effect: { hpCost: 10, gold: 85, redPens: 1 },
      },
      {
        id: 'play_safe',
        label: '普通にコインを入れる（ゴールド+45G）',
        effectDesc: '安全に45Gを獲得！',
        effect: { gold: 45 },
      },
    ],
  },
  {
    id: 'forbidden_rulebook',
    title: '焼却処分寸前の『裏・校則帳』',
    icon: '📖',
    description:
      '用務員室の焼却炉の前に、歴代番長が書き残した反則ルールブックが落ちている！',
    choices: [
      {
        id: 'unlock_rule',
        label: '裏ルールを解読する（ランダムな反則ルール1つ無料獲得！）',
        effectDesc: '未所持の反則ルールを1つ獲得！',
        effect: { grantRandomRule: true },
      },
      {
        id: 'sell_book',
        label: '闇市に売り飛ばす（ゴールド+70G＆HP15回復）',
        effectDesc: '70G獲得＆HP15回復！',
        effect: { gold: 70, heal: 15 },
      },
    ],
  },
  {
    id: 'bento_stand',
    title: '購買部の幻の特盛カツ丼',
    icon: '🍱',
    description:
      'おばちゃんがこっそり裏メニューを出してくれた。「あんた、いい殴りっぷりだね！食べていきな！」',
    choices: [
      {
        id: 'eat_katsudon',
        label: '特盛カツ丼を完食する（最大HP+15＆HP全回復！）',
        effectDesc: '最大HP+15＆HPが全回復した！',
        effect: { maxHpBonus: 15, fullHeal: true },
      },
      {
        id: 'take_lunch_money',
        label: 'お釣りだけ貰って改造費にする（ゴールド+60G＆赤ペン+1）',
        effectDesc: '60G＆赤ペン+1を獲得！',
        effect: { gold: 60, redPens: 1 },
      },
    ],
  },
  {
    id: 'mad_mechanic',
    title: 'マッド番長の魔改造ガレージ',
    icon: '🔧',
    description:
      '溶接マスクを被った先輩が笑う。「お前のコンボ枠、もっとネジ込めそうだな！」',
    choices: [
      {
        id: 'upgrade_mod_slot',
        label: '魔改造スロットを拡張する（HP-12・魔改造スロット+1 [最大3枠] または赤ペン+2）',
        effectDesc: '魔改造スロット+1（すでに3枠なら赤ペン+2）！',
        effect: { hpCost: 12, expandModSlotOrPens: true },
      },
      {
        id: 'get_rare_mod',
        label: 'レア魔改造カードと赤ペンを貰う（赤ペン+1＆50G）',
        effectDesc: '赤ペン+1＆50G獲得！',
        effect: { redPens: 1, gold: 50 },
      },
    ],
  },
];

// ============================================================================
// 7. CARD INSTANCE & RED PEN REWRITE HELPERS
// ============================================================================

/**
 * Creates a fresh mutable card instance from an ACTION_CARDS or MOD_CARDS template ID.
 */
export function createCardInstance(cardId) {
  const template = ACTION_CARDS[cardId] || MOD_CARDS[cardId];
  if (!template) {
    throw new Error(`Unknown card template ID: ${cardId}`);
  }
  return {
    ...structuredClone(template),
    uid: nextUid(template.type === 'action' ? 'act' : 'mod'),
    templateId: template.id,
    redPenMarks: [], // Array of applied Red Pen rewrite objects: { id, label, oldText, newText, stamp }
  };
}

/**
 * Returns the 3 permanent Red Pen rewrite options for a given card instance,
 * marking which ones have already been applied.
 */
export function getRedPenUpgrades(card) {
  if (!card) return [];
  const template = ACTION_CARDS[card.templateId || card.id] || MOD_CARDS[card.templateId || card.id];
  const options = card.redPenOptions || (template ? template.redPenOptions : []) || [];
  const appliedIds = new Set((card.redPenMarks || []).map((m) => m.id));
  return options.map((opt) => ({
    ...opt,
    alreadyApplied: appliedIds.has(opt.id),
  }));
}

/**
 * Permanently rewrites a card instance with a chosen Red Pen option!
 * Mutates and returns the card, storing `card.redPenMarks` so the UI can show
 * a literal red strikethrough over `oldText` and handwritten red text for `newText`.
 */
export function applyRedPenUpgrade(card, optionId) {
  if (!card) return null;
  const options = getRedPenUpgrades(card);
  const chosen = options.find((o) => o.id === optionId) || options.find((o) => !o.alreadyApplied);
  if (!chosen || chosen.alreadyApplied) {
    return card;
  }

  const p = chosen.patch || {};

  // Apply patches to Action or Mod card fields
  if (p.target) card.target = p.target;
  if (p.overrideTarget) card.overrideTarget = p.overrideTarget;
  if (p.baseDamageBonus) card.baseDamage = (card.baseDamage || 0) + p.baseDamageBonus;
  if (p.damageMultiplier) {
    if (card.type === 'action') {
      card.baseDamage = Math.round((card.baseDamage || 0) * p.damageMultiplier);
    } else {
      card.damageMultiplier = Number(((card.damageMultiplier || 1) * p.damageMultiplier).toFixed(2));
    }
  }
  if (p.damageMultiplierBonus) {
    card.damageMultiplier = Number(((card.damageMultiplier || 1) + p.damageMultiplierBonus).toFixed(2));
  }
  if (p.damageAddBonus) card.damageAdd = (card.damageAdd || 0) + p.damageAddBonus;
  if (p.hitsBonus) card.hits = (card.hits || 1) + p.hitsBonus;
  if (p.hitsAddBonus) card.hitsAdd = (card.hitsAdd || 0) + p.hitsAddBonus;
  if (p.splashDamageBonus) card.splashDamage = (card.splashDamage || 0) + p.splashDamageBonus;
  if (p.explosionOnHitBonus) card.explosionOnHit = (card.explosionOnHit || 0) + p.explosionOnHitBonus;
  if (p.explosionOnHitAdd) card.explosionOnHitAdd = (card.explosionOnHitAdd || 0) + p.explosionOnHitAdd;
  if (p.explosionOnHitAddBonus) card.explosionOnHitAdd = (card.explosionOnHitAdd || 0) + p.explosionOnHitAddBonus;
  if (p.explosionOnKillBonus) card.explosionOnKill = (card.explosionOnKill || 0) + p.explosionOnKillBonus;
  if (p.explosionOnKillAdd) card.explosionOnKillAdd = (card.explosionOnKillAdd || 0) + p.explosionOnKillAdd;
  if (p.guardGainBonus) card.guardGain = (card.guardGain || 0) + p.guardGainBonus;
  if (p.guardDamageRatioBonus) {
    card.guardDamageRatio = Number(((card.guardDamageRatio || 0) + p.guardDamageRatioBonus).toFixed(2));
  }
  if (p.missingHpDamageRatioBonus) {
    card.missingHpDamageRatio = Number(((card.missingHpDamageRatio || 0) + p.missingHpDamageRatioBonus).toFixed(2));
  }
  if (p.encoreCountBonus) card.encoreCount = (card.encoreCount || 1) + p.encoreCountBonus;
  if (p.guardOnHitBonus) card.guardOnHit = (card.guardOnHit || 0) + p.guardOnHitBonus;
  if (p.addGuardRatioToDamage) {
    card.addGuardRatioToDamage = (card.addGuardRatioToDamage || 0) + p.addGuardRatioToDamage;
  }
  if (p.addGuardRatioToDamageBonus) {
    card.addGuardRatioToDamage = Number(
      ((card.addGuardRatioToDamage || 0) + p.addGuardRatioToDamageBonus).toFixed(2)
    );
  }
  if (p.guardGainOnCastBonus) {
    card.guardGainOnCast = (card.guardGainOnCast || 0) + p.guardGainOnCastBonus;
  }
  if (p.paybackMinBonusAdd) {
    card.paybackMinBonus = (card.paybackMinBonus || 5) + p.paybackMinBonusAdd;
  }
  if (p.paybackMultiplierBonus) {
    card.paybackMultiplier = Number(((card.paybackMultiplier || 1) + p.paybackMultiplierBonus).toFixed(2));
  }
  if (p.maxLowHpMultiplierBonus) {
    card.maxLowHpMultiplier = Number(((card.maxLowHpMultiplier || 3) + p.maxLowHpMultiplierBonus).toFixed(2));
  }
  if (p.minLowHpMultiplier) {
    card.minLowHpMultiplier = p.minLowHpMultiplier;
  }
  if (p.healOnHitBonus) card.healOnHit = (card.healOnHit || 0) + p.healOnHitBonus;
  if (p.healOnKillBonus) card.healOnKill = (card.healOnKill || 0) + p.healOnKillBonus;
  if (p.vulnOnHitBonus) card.vulnOnHit = (card.vulnOnHit || 0) + p.vulnOnHitBonus;
  if (p.repeatCastAddBonus) card.repeatCastAdd = (card.repeatCastAdd || 1) + p.repeatCastAddBonus;

  if (!Array.isArray(card.redPenMarks)) {
    card.redPenMarks = [];
  }
  card.redPenMarks.push({
    id: chosen.id,
    label: chosen.label,
    oldText: chosen.oldText,
    newText: chosen.newText,
    stamp: chosen.stamp || '赤ペン改変！',
  });

  return card;
}
