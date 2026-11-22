/**
 * 『反則上等！』 (Hansoku Joto!) — Combat Engine & Roguelike Progression Manager
 *
 * Exports:
 * - MAX_CHAIN_STEPS (120)
 * - MetaProgression: localStorage persistence for unlocked styles, high scores, max combo, max turn damage
 * - RunState: full roguelike run state (HP, Guard, Gold, RedPens, Deck, Hand, Draw/Discard, Foul Rules, 3-Area branching node map, Shop/Reward generators)
 * - CombatEngine: deterministic/event-yielding battle engine with:
 *   - previewCombo(actionCard, modCards, targetEnemyId)
 *   - executePlayerFire(actionCard, modCards, targetEnemyId)
 *   - executeEnemyTurn()
 */

import {
  STARTER_LOADOUTS,
  ACTION_CARDS,
  MOD_CARDS,
  FOUL_RULES,
  ENEMY_TEMPLATES,
  AREA_CONFIGS,
  AREA_ENCOUNTERS,
  MYSTERY_EVENTS,
  createCardInstance,
  getRedPenUpgrades,
  applyRedPenUpgrade,
  nextUid,
} from './data.js';

export {
  STARTER_LOADOUTS,
  ACTION_CARDS,
  MOD_CARDS,
  FOUL_RULES,
  ENEMY_TEMPLATES,
  AREA_CONFIGS,
  AREA_ENCOUNTERS,
  MYSTERY_EVENTS,
  createCardInstance,
  getRedPenUpgrades,
  applyRedPenUpgrade,
  nextUid,
};

export const MAX_CHAIN_STEPS = 120;
const META_STORAGE_KEY = 'hansoku_joto_meta_v1';

// Safe localStorage wrapper for both browser and Node test environments
const memoryStorage = new Map();
function getStorage() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return {
    getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
    setItem: (k, v) => memoryStorage.set(k, String(v)),
    removeItem: (k) => memoryStorage.delete(k),
  };
}

// ============================================================================
// 1. META-PROGRESSION (localStorage save/load)
// ============================================================================

export class MetaProgression {
  static load() {
    const defaultMeta = {
      unlockedLoadouts: ['brawler', 'speedster', 'fortress'],
      highScore: 0,
      maxComboRecord: 0,
      maxTurnDamageRecord: 0,
      totalRuns: 0,
      totalVictories: 0,
      totalKills: 0,
    };
    try {
      const raw = getStorage().getItem(META_STORAGE_KEY);
      if (!raw) return defaultMeta;
      const parsed = JSON.parse(raw);
      return {
        ...defaultMeta,
        ...parsed,
        unlockedLoadouts: Array.from(
          new Set([...defaultMeta.unlockedLoadouts, ...(parsed.unlockedLoadouts || [])])
        ),
      };
    } catch {
      return defaultMeta;
    }
  }

  static save(meta) {
    try {
      getStorage().setItem(META_STORAGE_KEY, JSON.stringify(meta));
    } catch {
      // Ignore quota errors
    }
    return meta;
  }

  static recordBattleStats({ combo = 0, turnDamage = 0, kills = 0, score = 0, victory = false } = {}) {
    const meta = MetaProgression.load();
    if (combo > meta.maxComboRecord) meta.maxComboRecord = combo;
    if (turnDamage > meta.maxTurnDamageRecord) meta.maxTurnDamageRecord = turnDamage;
    if (score > meta.highScore) meta.highScore = score;
    meta.totalKills = (meta.totalKills || 0) + kills;
    if (victory) meta.totalVictories = (meta.totalVictories || 0) + 1;
    MetaProgression.save(meta);
    return meta;
  }
}

// ============================================================================
// 2. RUN STATE MANAGER (Roguelike Deck, Rules, Map, Shop, Rewards)
// ============================================================================

export class RunState {
  constructor(loadoutId = 'brawler') {
    const loadout = STARTER_LOADOUTS[loadoutId] || STARTER_LOADOUTS.brawler;
    this.loadoutId = loadout.id;
    this.loadoutName = loadout.name;

    this.maxHp = loadout.maxHp;
    this.hp = loadout.maxHp;
    this.guard = 0;
    this.gold = loadout.startingGold;
    this.redPens = loadout.startingRedPens;

    // Bare punch fallback card instance (always available even without an action card in hand)
    this.barePunchCard = createCardInstance('bare_punch');

    // Build initial deck of card instances
    this.deck = [
      ...loadout.actionCards.map((id) => createCardInstance(id)),
      ...loadout.modCards.map((id) => createCardInstance(id)),
    ];

    this.hand = [];
    this.drawPile = [];
    this.discardPile = [];
    this.handSize = 6;

    // Mod slots per combo (starts at 2, expandable to 3 via shop/event)
    this.maxModSlots = 2;

    // Foul rules (starts with maxEquippedRules = 2, expandable to 3 via shop)
    this.maxEquippedRules = 2;
    this.unlockedRules = [loadout.startingRule];
    this.equippedRules = [loadout.startingRule];

    // Area & Map progression (3 Areas x 5 steps per area)
    this.currentArea = 1;
    this.currentStep = 0; // 0..4 within currentArea
    this.currentNodeId = null;
    this.completedNodeIds = [];
    this.areaMaps = {
      1: RunState.generateAreaMap(1),
      2: RunState.generateAreaMap(2),
      3: RunState.generateAreaMap(3),
    };

    // Run statistics
    this.stats = {
      floorsCleared: 0,
      enemiesDefeated: 0,
      maxComboInRun: 0,
      maxTurnDamageInRun: 0,
      totalDamageDealt: 0,
      redPensUsed: 0,
    };

    const meta = MetaProgression.load();
    meta.totalRuns = (meta.totalRuns || 0) + 1;
    MetaProgression.save(meta);
  }

  /**
   * Generates a 5-step branching map for an Area:
   * Step 0: Normal Battle (2 entry choices)
   * Step 1: Battle or Mystery Event / Red Pen Workshop
   * Step 2: Elite Battle or Red Pen Workshop or Black Market Shop
   * Step 3: Black Market Shop or Red Pen Workshop or Elite Battle
   * Step 4: Area Boss (single convergence node)
   */
  static generateAreaMap(areaNumber = 1) {
    const areaCfg = AREA_CONFIGS[areaNumber] || AREA_CONFIGS[1];
    const steps = [
      // Step 0
      [
        {
          id: `a${areaNumber}_s0_n0`,
          area: areaNumber,
          step: 0,
          lane: 0,
          type: 'battle',
          title: '反則喧嘩バトル',
          subtitle: '敵を吹き飛ばしてカード＆資金奪取',
          icon: '⚔️',
          nextIds: [`a${areaNumber}_s1_n0`, `a${areaNumber}_s1_n1`],
        },
        {
          id: `a${areaNumber}_s0_n1`,
          area: areaNumber,
          step: 0,
          lane: 1,
          type: 'battle',
          title: '裏路地乱闘バトル',
          subtitle: '多勢に無勢？連鎖爆発のカモだ！',
          icon: '💥',
          nextIds: [`a${areaNumber}_s1_n1`, `a${areaNumber}_s1_n2`],
        },
      ],
      // Step 1
      [
        {
          id: `a${areaNumber}_s1_n0`,
          area: areaNumber,
          step: 1,
          lane: 0,
          type: 'workshop',
          title: '赤ペン魔改造教室',
          subtitle: 'カードのテキストを赤ペンで永久書き換え！',
          icon: '🖍️',
          nextIds: [`a${areaNumber}_s2_n0`, `a${areaNumber}_s2_n1`],
        },
        {
          id: `a${areaNumber}_s1_n1`,
          area: areaNumber,
          step: 1,
          lane: 1,
          type: 'battle',
          title: '校庭制圧バトル',
          subtitle: 'コンボを試して報酬カード＆ゴールド獲得',
          icon: '🥊',
          nextIds: [`a${areaNumber}_s2_n0`, `a${areaNumber}_s2_n1`, `a${areaNumber}_s2_n2`],
        },
        {
          id: `a${areaNumber}_s1_n2`,
          area: areaNumber,
          step: 1,
          lane: 2,
          type: 'mystery',
          title: 'ハプニング路地裏',
          subtitle: '赤ペン先生や違法スロットなど何が出るかお楽しみ！',
          icon: '❓',
          nextIds: [`a${areaNumber}_s2_n1`, `a${areaNumber}_s2_n2`],
        },
      ],
      // Step 2
      [
        {
          id: `a${areaNumber}_s2_n0`,
          area: areaNumber,
          step: 2,
          lane: 0,
          type: 'elite',
          title: '強敵エリート番長',
          subtitle: '撃破で『反則ルール』または赤ペン＆大量ゴールド！',
          icon: '👹',
          nextIds: [`a${areaNumber}_s3_n0`, `a${areaNumber}_s3_n1`],
        },
        {
          id: `a${areaNumber}_s2_n1`,
          area: areaNumber,
          step: 2,
          lane: 1,
          type: 'shop',
          title: '購買部・裏闇市',
          subtitle: '反則ルール、赤ペン、魔改造スロット拡張を購入！',
          icon: '🛒',
          nextIds: [`a${areaNumber}_s3_n0`, `a${areaNumber}_s3_n1`, `a${areaNumber}_s3_n2`],
        },
        {
          id: `a${areaNumber}_s2_n2`,
          area: areaNumber,
          step: 2,
          lane: 2,
          type: 'elite',
          title: '取締エリート部隊',
          subtitle: '高HPの敵をインフレコンボで粉砕せよ！',
          icon: '🚨',
          nextIds: [`a${areaNumber}_s3_n1`, `a${areaNumber}_s3_n2`],
        },
      ],
      // Step 3
      [
        {
          id: `a${areaNumber}_s3_n0`,
          area: areaNumber,
          step: 3,
          lane: 0,
          type: 'shop',
          title: '決戦前・闇市ショップ',
          subtitle: 'ボス戦前にルール枠拡張や強力カードを調達！',
          icon: '💰',
          nextIds: [`a${areaNumber}_s4_boss`],
        },
        {
          id: `a${areaNumber}_s3_n1`,
          area: areaNumber,
          step: 3,
          lane: 1,
          type: 'workshop',
          title: '決戦前・赤ペン工房',
          subtitle: '赤ペン+1入手＆主力カードを最終魔改造！',
          icon: '🖍️',
          nextIds: [`a${areaNumber}_s4_boss`],
        },
        {
          id: `a${areaNumber}_s3_n2`,
          area: areaNumber,
          step: 3,
          lane: 2,
          type: 'mystery',
          title: '番長の隠し倉庫',
          subtitle: '大回復かさらなる反則強化か！？',
          icon: '🎁',
          nextIds: [`a${areaNumber}_s4_boss`],
        },
      ],
      // Step 4 (Boss)
      [
        {
          id: `a${areaNumber}_s4_boss`,
          area: areaNumber,
          step: 4,
          lane: 1,
          type: 'boss',
          title: areaCfg.bossTitle,
          subtitle:
            areaNumber === 3
              ? '最終決戦！完成した反則コンボで審判長を吹き飛ばせ！'
              : 'エリアボス撃破で次エリア解放＆豪華報酬！',
          icon: areaNumber === 3 ? '👑' : '💀',
          nextIds: [],
        },
      ],
    ];

    return {
      area: areaNumber,
      name: areaCfg.name,
      subtitle: areaCfg.subtitle,
      themeColor: areaCfg.themeColor,
      steps,
    };
  }

  getCurrentAreaMap() {
    return this.areaMaps[this.currentArea];
  }

  getAvailableNextNodes() {
    const map = this.getCurrentAreaMap();
    if (!map) return [];
    if (!this.currentNodeId) {
      return map.steps[0] || [];
    }
    let currentNode = null;
    for (const stepNodes of map.steps) {
      for (const n of stepNodes) {
        if (n.id === this.currentNodeId) {
          currentNode = n;
          break;
        }
      }
    }
    if (!currentNode) return map.steps[0] || [];
    const nextStepNodes = map.steps[currentNode.step + 1] || [];
    return nextStepNodes.filter((n) => currentNode.nextIds.includes(n.id));
  }

  selectNode(nodeId) {
    const map = this.getCurrentAreaMap();
    for (const stepNodes of map.steps) {
      for (const node of stepNodes) {
        if (node.id === nodeId) {
          this.currentNodeId = node.id;
          this.currentStep = node.step;
          if (!this.completedNodeIds.includes(node.id)) {
            this.completedNodeIds.push(node.id);
          }
          return node;
        }
      }
    }
    return null;
  }

  advanceToNextArea() {
    if (this.currentArea < 3) {
      this.currentArea += 1;
      this.currentStep = 0;
      this.currentNodeId = null;
      // Heal 35% of max HP between areas
      this.heal(Math.round(this.maxHp * 0.35));
      return true;
    }
    return false;
  }

  heal(amount) {
    const prev = this.hp;
    this.hp = Math.min(this.maxHp, Math.max(0, this.hp + amount));
    return this.hp - prev;
  }

  addCardToDeck(cardIdOrInstance) {
    const instance =
      typeof cardIdOrInstance === 'string'
        ? createCardInstance(cardIdOrInstance)
        : cardIdOrInstance;
    this.deck.push(instance);
    return instance;
  }

  removeCardFromDeck(cardUid) {
    const idx = this.deck.findIndex((c) => c.uid === cardUid);
    if (idx !== -1 && this.deck.length > 4) {
      const [removed] = this.deck.splice(idx, 1);
      return removed;
    }
    return null;
  }

  rewriteCardWithRedPen(cardUid, optionId, consumePen = true) {
    if (consumePen && this.redPens <= 0) return null;
    const target =
      this.deck.find((c) => c.uid === cardUid) ||
      this.hand.find((c) => c.uid === cardUid) ||
      (this.barePunchCard.uid === cardUid ? this.barePunchCard : null);
    if (!target) return null;

    const beforeMarks = (target.redPenMarks || []).length;
    applyRedPenUpgrade(target, optionId);
    const afterMarks = (target.redPenMarks || []).length;

    if (afterMarks > beforeMarks) {
      if (consumePen) this.redPens = Math.max(0, this.redPens - 1);
      this.stats.redPensUsed += 1;
    }
    return target;
  }

  unlockAndEquipRule(ruleId) {
    if (!FOUL_RULES[ruleId]) return false;
    if (!this.unlockedRules.includes(ruleId)) {
      this.unlockedRules.push(ruleId);
    }
    if (!this.equippedRules.includes(ruleId) && this.equippedRules.length < this.maxEquippedRules) {
      this.equippedRules.push(ruleId);
    }
    return true;
  }

  toggleEquipRule(ruleId) {
    if (!this.unlockedRules.includes(ruleId)) return false;
    const idx = this.equippedRules.indexOf(ruleId);
    if (idx !== -1) {
      this.equippedRules.splice(idx, 1);
      return true;
    }
    if (this.equippedRules.length < this.maxEquippedRules) {
      this.equippedRules.push(ruleId);
      return true;
    }
    // Replace oldest equipped rule if full
    this.equippedRules.shift();
    this.equippedRules.push(ruleId);
    return true;
  }

  /**
   * Generates reward choices after winning a battle
   */
  generateBattleRewards(nodeType = 'battle') {
    const actionIds = Object.keys(ACTION_CARDS).filter((id) => id !== 'bare_punch');
    const modIds = Object.keys(MOD_CARDS);

    const shuffledActions = [...actionIds].sort(() => Math.random() - 0.5);
    const shuffledMods = [...modIds].sort(() => Math.random() - 0.5);

    // Always offer 1 Action Card and 2 Mod Cards (and pre-apply a Red Pen mark on Elite/Boss rewards!)
    const cardChoices = [
      createCardInstance(shuffledActions[0]),
      createCardInstance(shuffledMods[0]),
      createCardInstance(shuffledMods[1]),
    ];

    if (nodeType === 'elite' || nodeType === 'boss') {
      // Bonus: one of the reward cards comes pre-stamped with a Red Pen upgrade!
      const luckyCard = cardChoices[Math.floor(Math.random() * cardChoices.length)];
      const opts = getRedPenUpgrades(luckyCard);
      if (opts.length > 0) {
        applyRedPenUpgrade(luckyCard, opts[0].id);
      }
    }

    const goldReward =
      nodeType === 'boss'
        ? 95 + this.currentArea * 25
        : nodeType === 'elite'
        ? 55 + this.currentArea * 15
        : 32 + this.currentArea * 10;

    const redPenReward = nodeType === 'boss' || nodeType === 'elite' ? 1 : Math.random() < 0.35 ? 1 : 0;

    // On elite or boss, also offer an unowned Foul Rule!
    let bonusRuleId = null;
    if (nodeType === 'elite' || nodeType === 'boss') {
      const unownedRules = Object.keys(FOUL_RULES).filter((id) => !this.unlockedRules.includes(id));
      if (unownedRules.length > 0) {
        bonusRuleId = unownedRules[Math.floor(Math.random() * unownedRules.length)];
      }
    }

    return {
      goldReward,
      redPenReward,
      bonusRuleId,
      cardChoices,
    };
  }

  /**
   * Generates items for the Black Market Shop
   */
  generateShopInventory() {
    const actionIds = Object.keys(ACTION_CARDS)
      .filter((id) => id !== 'bare_punch')
      .sort(() => Math.random() - 0.5);
    const modIds = Object.keys(MOD_CARDS).sort(() => Math.random() - 0.5);

    const cards = [
      { card: createCardInstance(actionIds[0]), price: 35, sold: false },
      { card: createCardInstance(modIds[0]), price: 38, sold: false },
      { card: createCardInstance(modIds[1]), price: 42, sold: false },
    ];

    const unownedRules = Object.keys(FOUL_RULES)
      .filter((id) => !this.unlockedRules.includes(id))
      .sort(() => Math.random() - 0.5);

    const rules = unownedRules.slice(0, 2).map((id) => ({
      rule: FOUL_RULES[id],
      price: FOUL_RULES[id].price || 55,
      sold: false,
    }));

    const services = [
      {
        id: 'buy_red_pen',
        name: '赤ペン極太マジック（+1本）',
        icon: '🖍️',
        description: '好きなカードのテキストを永久に書き換える反則赤ペン！',
        price: 40,
        sold: false,
      },
      {
        id: 'expand_rule_slot',
        name: '反則ルール装備枠拡張（2枠→3枠）',
        icon: '📜',
        description: '同時に発動できる反則ルールの上限を3つに増やす！',
        price: 75,
        sold: this.maxEquippedRules >= 3,
      },
      {
        id: 'expand_mod_slot',
        name: '魔改造スロット拡張（2枠→3枠）',
        icon: '🔧',
        description: '1回の行動カードに組み合わせられる魔改造カードを3枚に増やす！',
        price: 80,
        sold: this.maxModSlots >= 3,
      },
      {
        id: 'shop_heal',
        name: '購買部の特製焼きそばパン（HP40回復）',
        icon: '🥖',
        description: 'HPを40回復して連戦に備える！',
        price: 25,
        sold: false,
      },
    ];

    return { cards, rules, services };
  }
}

// ============================================================================
// 3. COMBAT ENGINE (Combo Preview + Step-by-Step Timeline Execution)
// ============================================================================

export class CombatEngine {
  /**
   * @param {RunState} runState
   * @param {object} encounterOptions - { nodeType: 'battle'|'elite'|'boss', enemyIds?: string[] }
   */
  constructor(runState, encounterOptions = {}) {
    this.runState = runState || new RunState('brawler');
    this.nodeType = encounterOptions.nodeType || 'battle';
    this.area = this.runState.currentArea || 1;
    this.areaConfig = AREA_CONFIGS[this.area] || AREA_CONFIGS[1];

    this.turn = 1;
    this.isBattleOver = false;
    this.result = null; // 'victory' | 'defeat' | null

    // Per-battle dynamic state
    this.runState.guard = 0;
    this.damageTakenSinceLastTurn = 0;
    this.permanentBattleDamageBonus = 0; // From 'blood_alchemy' rule
    this.turnChainScalingBonus = 0; // From 'chain_scaling' rule
    this.firstKillDoneThisTurn = false;
    this.turnComboCount = 0;
    this.lastJackpotMilestone = 0;

    // Spawn enemies
    const enemyIds = encounterOptions.enemyIds || this._pickEncounterEnemyIds();
    this.enemies = enemyIds.map((templateId, idx) => this._createEnemyInstance(templateId, idx));

    // Prepare deck piles and draw initial hand
    this._initDeckForCombat();
    this.startPlayerTurn();
  }

  _pickEncounterEnemyIds() {
    const cfg = this.areaConfig;
    if (this.nodeType === 'boss') {
      return [...cfg.bossPool];
    }
    if (this.nodeType === 'elite') {
      const pool = cfg.elitePools[Math.floor(Math.random() * cfg.elitePools.length)];
      return [...pool];
    }
    const pool = cfg.normalPools[Math.floor(Math.random() * cfg.normalPools.length)];
    return [...pool];
  }

  _createEnemyInstance(templateId, positionIndex = 0) {
    const tpl = ENEMY_TEMPLATES[templateId] || ENEMY_TEMPLATES.sandbag_jr;
    const hpScale = tpl.isBoss ? 1.0 : this.areaConfig.hpScale || 1.0;
    const scaledMaxHp = Math.round(tpl.maxHp * hpScale);

    return {
      uid: nextUid(`enemy_${tpl.id}`),
      templateId: tpl.id,
      name: tpl.name,
      subtitle: tpl.subtitle,
      modelType: tpl.modelType,
      color: tpl.color,
      accentColor: tpl.accentColor,
      scale: tpl.scale || 1.0,
      maxHp: scaledMaxHp,
      hp: scaledMaxHp,
      armor: tpl.armor || 0,
      vulnerable: 0, // Extra damage taken per hit (from 'armor_crush')
      counterDamage: tpl.counterDamage || 0,
      deathExplosionEnemyDamage: tpl.deathExplosionEnemyDamage || 0,
      deathExplosionPlayerDamage: tpl.deathExplosionPlayerDamage || 0,
      summonOnTurnEnd: tpl.summonOnTurnEnd || null,
      bossCounterEveryHits: tpl.bossCounterEveryHits || 0,
      bossCounterDamage: tpl.bossCounterDamage || 0,
      hitsTakenCounter: 0,
      passiveName: tpl.passiveName,
      passiveDesc: tpl.passiveDesc,
      isElite: Boolean(tpl.isElite),
      isBoss: Boolean(tpl.isBoss),
      intents: structuredClone(tpl.intents || [{ type: 'attack', damage: 6, label: '攻撃 (6)' }]),
      intentIndex: 0,
      positionIndex,
      alive: true,
    };
  }

  _initDeckForCombat() {
    this.runState.hand = [];
    this.runState.discardPile = [];
    this.runState.drawPile = this.runState.deck.map((c) => structuredClone(c));
    this._shuffle(this.runState.drawPile);
  }

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  getAliveEnemies() {
    return this.enemies.filter((e) => e.alive && e.hp > 0);
  }

  getEnemyById(enemyId) {
    return this.enemies.find((e) => e.uid === enemyId);
  }

  getCurrentIntent(enemy) {
    if (!enemy || !enemy.intents || enemy.intents.length === 0) {
      return { type: 'attack', damage: 5, label: '攻撃 (5)' };
    }
    const intent = enemy.intents[enemy.intentIndex % enemy.intents.length];
    const dmgScale = enemy.isBoss ? 1.0 : this.areaConfig.dmgScale || 1.0;
    const scaledDamage = intent.damage ? Math.round(intent.damage * dmgScale) : 0;
    return {
      ...intent,
      damage: scaledDamage,
    };
  }

  hasRule(ruleId) {
    return this.runState.equippedRules.includes(ruleId);
  }

  /**
   * Starts the player's turn: resets per-turn counters and draws up to `handSize` (6) cards.
   * Ensures at least 1 Action Card and 1 Mod Card are drawn when possible so the player can always build a combo!
   */
  startPlayerTurn() {
    this.turnChainScalingBonus = 0;
    this.firstKillDoneThisTurn = false;
    this.turnComboCount = 0;
    this.lastJackpotMilestone = 0;

    // Discard remaining hand from previous turn
    while (this.runState.hand.length > 0) {
      this.runState.discardPile.push(this.runState.hand.pop());
    }

    this.drawCards(this.runState.handSize);
  }

  drawCards(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.runState.drawPile.length === 0) {
        if (this.runState.discardPile.length === 0) break;
        this.runState.drawPile = this.runState.discardPile.splice(0);
        this._shuffle(this.runState.drawPile);
      }
      const card = this.runState.drawPile.pop();
      if (card) {
        this.runState.hand.push(card);
        drawn.push(card);
      }
    }
    return drawn;
  }

  // ==========================================================================
  // COMBO PREVIEW CALCULATION
  // ==========================================================================

  /**
   * Computes a deterministic, human-readable preview of what the selected Action Card + Mod Cards
   * will do before the player presses FIRE (`ぶっ放す！`).
   *
   * @param {object|null} actionCard - Selected Action Card (falls back to bare_punch if null/omitted)
   * @param {object[]} modCards - Array of selected Mod Cards (up to maxModSlots)
   * @param {string|null} targetEnemyId - Optional target enemy UID
   */
  previewCombo(actionCard = null, modCards = [], targetEnemyId = null) {
    const act = actionCard || this.runState.barePunchCard || createCardInstance('bare_punch');
    const mods = (modCards || []).filter(Boolean);

    const aliveEnemies = this.getAliveEnemies();
    const primaryTarget =
      aliveEnemies.find((e) => e.uid === targetEnemyId) || aliveEnemies[0] || null;

    // 1. Resolve repeat casts (from 'double_cast')
    let repeatCasts = 1;
    for (const m of mods) {
      if (m.repeatCastAdd) repeatCasts += m.repeatCastAdd;
    }

    // 2. Resolve target mode ('single' or 'all')
    let targetMode = act.target || 'single';
    for (const m of mods) {
      if (m.overrideTarget === 'all') targetMode = 'all';
    }

    // 3. Resolve hits per cast
    let hitsPerCast = act.hits || 1;
    for (const m of mods) {
      if (m.hitsAdd) hitsPerCast += m.hitsAdd;
    }
    const crisisActive =
      this.hasRule('crisis_fury') && this.runState.hp <= Math.ceil(this.runState.maxHp * 0.5);
    if (crisisActive) {
      hitsPerCast += 1;
    }

    const estimatedHits = hitsPerCast * repeatCasts;

    // 4. Resolve guard gained on cast (before hits)
    let guardGainPerCast = act.guardGain || 0;
    for (const m of mods) {
      if (m.guardGainOnCast) guardGainPerCast += m.guardGainOnCast;
    }
    const projectedGuardOnFirstCast = this.runState.guard + guardGainPerCast;

    // 5. Resolve base damage & multipliers
    let baseDamage = (act.baseDamage || 0) + this.permanentBattleDamageBonus;
    if (act.guardDamageRatio) {
      baseDamage += Math.round(projectedGuardOnFirstCast * act.guardDamageRatio);
    }
    if (act.missingHpDamageRatio) {
      const missingHp = Math.max(0, this.runState.maxHp - this.runState.hp);
      baseDamage += Math.round(missingHp * act.missingHpDamageRatio);
    }

    let flatAdd = 0;
    let totalMultiplier = 1.0;
    let explosionOnHit = act.explosionOnHit || 0;
    let explosionOnKill = act.explosionOnKill || 0;
    let guardOnHit = 0;
    let pierceArmor = Boolean(act.armorPiercing);
    let vulnOnHit = 0;
    let encoreCount = 0;
    let healOnHit = 0;
    let healOnKill = 0;

    for (const m of mods) {
      if (m.damageAdd) flatAdd += m.damageAdd;
      if (m.damageMultiplier && m.damageMultiplier !== 1) {
        totalMultiplier *= m.damageMultiplier;
      }
      if (m.explosionOnHitAdd) explosionOnHit += m.explosionOnHitAdd;
      if (m.explosionOnKillAdd) explosionOnKill += m.explosionOnKillAdd;
      if (m.guardOnHit) guardOnHit += m.guardOnHit;
      if (m.addGuardRatioToDamage) {
        flatAdd += Math.round(projectedGuardOnFirstCast * m.addGuardRatioToDamage);
      }
      if (m.paybackMode) {
        const paybackBonus = Math.max(
          m.paybackMinBonus || 5,
          Math.round(this.damageTakenSinceLastTurn * (m.paybackMultiplier || 1.0))
        );
        flatAdd += paybackBonus;
      }
      if (m.lowHpScaling) {
        const enemyRatio = primaryTarget ? primaryTarget.hp / primaryTarget.maxHp : 0.5;
        const playerRatio = this.runState.hp / this.runState.maxHp;
        const lowestRatio = Math.min(enemyRatio, playerRatio);
        const maxMult = m.maxLowHpMultiplier || 3.0;
        const minMult = m.minLowHpMultiplier || 1.25;
        const dynMult = minMult + (1 - lowestRatio) * (maxMult - minMult);
        totalMultiplier *= Math.min(maxMult, Math.max(minMult, dynMult));
      }
      if (m.pierceArmor) pierceArmor = true;
      if (m.vulnOnHit) vulnOnHit += m.vulnOnHit;
      if (m.encoreOnKill) encoreCount += m.encoreCount || 1;
      if (m.healOnHit) healOnHit += m.healOnHit;
      if (m.healOnKill) healOnKill += m.healOnKill;
    }

    if (crisisActive) {
      totalMultiplier *= 1.5;
    }

    const rawDamagePerHit = Math.max(0, Math.round((baseDamage + flatAdd) * totalMultiplier));
    const targetArmor =
      primaryTarget && !pierceArmor ? Math.max(0, primaryTarget.armor || 0) : 0;
    const targetVuln = primaryTarget ? primaryTarget.vulnerable || 0 : 0;

    const estimatedDamagePerHit = Math.max(
      1,
      rawDamagePerHit + targetVuln + this.turnChainScalingBonus - targetArmor
    );

    const targetCount = targetMode === 'all' ? Math.max(1, aliveEnemies.length) : 1;
    const totalActualHits = estimatedHits * targetCount;

    // Account for progressive vulnOnHit or chain_scaling across hits in total estimate
    let estimatedTotalDirectDamage = 0;
    let simChainBonus = this.turnChainScalingBonus;
    let simVuln = targetVuln;
    const hasChainScaling = this.hasRule('chain_scaling');

    for (let h = 0; h < totalActualHits; h++) {
      const hitDmg = Math.max(1, rawDamagePerHit + simVuln + simChainBonus - targetArmor);
      estimatedTotalDirectDamage += hitDmg;
      if (vulnOnHit > 0) simVuln += vulnOnHit;
      if (hasChainScaling) simChainBonus += 2;
    }

    const triggersExplosion = explosionOnHit > 0 || explosionOnKill > 0 || this.hasRule('death_chain');
    const totalExplosionDamagePerTarget =
      explosionOnHit * totalActualHits + (explosionOnKill > 0 ? explosionOnKill : 0);

    // 6. Build human-readable synergy breakdown tags
    const activeSynergies = [];

    if (repeatCasts > 1) {
      activeSynergies.push(`二重詠唱 → コンボ全体を${repeatCasts}回連続発動！`);
    }
    if (targetMode === 'all' && aliveEnemies.length > 1) {
      activeSynergies.push(`全体攻撃化 → 敵${aliveEnemies.length}体すべてに${estimatedHits}連撃！`);
    }
    if (estimatedHits >= 3 && explosionOnHit > 0) {
      activeSynergies.push(
        `${estimatedHits}連撃 × 誘爆(${explosionOnHit}) → 命中ごとに全体爆発${totalActualHits}連発！`
      );
    } else if (explosionOnHit > 0) {
      activeSynergies.push(`誘爆 → 命中ごとに敵全員へ${explosionOnHit}ダメージ爆発！`);
    }
    if (guardOnHit > 0 && totalActualHits >= 2) {
      activeSynergies.push(
        `保険 × ${totalActualHits}ヒット → 合計ガード+${guardOnHit * totalActualHits}獲得！`
      );
    }
    if (encoreCount > 0) {
      activeSynergies.push(`おかわり → 敵撃破時に別ターゲットへ丸ごと追加攻撃！`);
    }
    if (pierceArmor && vulnOnHit > 0) {
      activeSynergies.push(`装甲破壊 → アーマー貫通＆命中ごと被ダメ+${vulnOnHit}累積！`);
    }
    if (this.hasRule('death_chain')) {
      activeSynergies.push(`死体爆弾ルール → 敵撃破時に全体7ダメージ連鎖爆発！`);
    }
    if (this.hasRule('first_blood_nuke') && !this.firstKillDoneThisTurn) {
      activeSynergies.push(`見せしめ大爆発 → 最初の撃破で全体12ダメージ特大爆発！`);
    }
    if (this.hasRule('chain_scaling')) {
      activeSynergies.push(`連撃インフレ → 命中・爆発ごとに全ダメージが+2ずつ急上昇！`);
    }
    if (this.hasRule('guard_artillery') && (guardGainPerCast > 0 || guardOnHit > 0 || this.hasRule('blast_shield'))) {
      activeSynergies.push(`要塞砲撃ルール → ガード獲得ごとに100%威力の自動砲撃！`);
    }
    if (this.hasRule('overkill_transfer')) {
      activeSynergies.push(`余剰ダメージ転嫁 → オーバーキル分100%を別の敵へ雷撃転送！`);
    }
    if (crisisActive) {
      activeSynergies.push(`火事場の反則力 → HP50%以下で回数+1＆威力1.5倍発動中！`);
    }

    return {
      actionCard: act,
      modCards: mods,
      targetMode,
      estimatedHits,
      repeatCasts,
      hitsPerCast,
      estimatedDamagePerHit,
      estimatedTotalDirectDamage,
      triggersExplosion,
      explosionDamagePerHit: explosionOnHit,
      totalExplosionDamagePerTarget,
      projectedGuardGain: guardGainPerCast * repeatCasts + guardOnHit * totalActualHits,
      activeSynergies,
    };
  }

  // ==========================================================================
  // STEP-BY-STEP PLAYER COMBO EXECUTION (Battle Timeline Event Generator)
  // ==========================================================================

  /**
   * Executes the player's selected Action Card + Mod Cards against `targetEnemyId`
   * and returns an ordered array of discrete Battle Timeline Events (`events`)
   * for the 3D Arena and UI to animate with dynamic acceleration, hitstop, and particles.
   */
  executePlayerFire(actionCard = null, modCards = [], targetEnemyId = null) {
    const act = actionCard || this.runState.barePunchCard || createCardInstance('bare_punch');
    const mods = (modCards || []).filter(Boolean);

    // Move used cards from hand to discardPile (except bare_punch)
    const usedUids = new Set([act.uid, ...mods.map((m) => m.uid)]);
    const remainingHand = [];
    for (const c of this.runState.hand) {
      if (usedUids.has(c.uid) && !c.isBasic) {
        this.runState.discardPile.push(c);
      } else {
        remainingHand.push(c);
      }
    }
    this.runState.hand = remainingHand;

    const events = [];
    let stepCount = 0;
    let totalDamageThisFire = 0;
    let killsThisFire = 0;

    const canContinue = () => stepCount < MAX_CHAIN_STEPS && this.getAliveEnemies().length > 0;
    const incCombo = () => {
      this.turnComboCount += 1;
      return this.turnComboCount;
    };

    // Build dramatic combo title
    const modPrefix = mods.map((m) => m.name).join('×');
    const comboTitle = modPrefix ? `【反則魔改造】${modPrefix}・${act.name}！！` : `【発射】${act.name}！`;

    events.push({
      type: 'COMBO_START',
      title: comboTitle,
      actionCard: structuredClone(act),
      modCards: structuredClone(mods),
    });

    // Helper: check 10-combo jackpot rule
    const checkJackpot = () => {
      if (!this.hasRule('combo_jackpot')) return;
      const milestone = Math.floor(this.turnComboCount / 10);
      if (milestone > this.lastJackpotMilestone && stepCount < MAX_CHAIN_STEPS) {
        this.lastJackpotMilestone = milestone;
        stepCount += 1;
        this.runState.gold += 15;
        events.push({
          type: 'RULE_TRIGGER',
          ruleId: 'combo_jackpot',
          ruleName: FOUL_RULES.combo_jackpot.name,
          description: `${milestone * 10}連鎖達成！敵全員に15ダメージ＆+15G！！`,
          comboCount: this.turnComboCount,
        });
        events.push({
          type: 'JACKPOT',
          comboCount: this.turnComboCount,
          totalDamage: 15,
          goldGained: 15,
        });
        triggerExplosion('10連鎖ジャックポット', 15, true);
      }
    };

    // Helper: gain guard + trigger 'guard_artillery' foul rule
    const gainGuard = (amount, source) => {
      if (amount <= 0 || stepCount >= MAX_CHAIN_STEPS) return;
      this.runState.guard += amount;
      events.push({
        type: 'GUARD_GAIN',
        amount,
        source,
        newGuard: this.runState.guard,
      });

      if (this.hasRule('guard_artillery') && canContinue()) {
        stepCount += 1;
        const alive = this.getAliveEnemies();
        if (alive.length > 0) {
          const artilleryTarget = alive[Math.floor(Math.random() * alive.length)];
          const comboNow = incCombo();
          events.push({
            type: 'RULE_TRIGGER',
            ruleId: 'guard_artillery',
            ruleName: FOUL_RULES.guard_artillery.name,
            description: `ガード+${amount}獲得に反応して${artilleryTarget.name}へ${amount}ダメージ砲撃！`,
            comboCount: comboNow,
          });
          applyDamageToEnemy(artilleryTarget, amount, {
            source: '要塞砲撃ルール',
            isDirectAttack: false,
            pierceArmor: true,
            hitIndex: 1,
            totalHits: 1,
          });
          checkJackpot();
        }
      }
    };

    // Helper: heal player
    const healPlayer = (amount, source) => {
      if (amount <= 0) return;
      const healed = this.runState.heal(amount);
      if (healed > 0) {
        events.push({
          type: 'HEAL',
          amount: healed,
          newHp: this.runState.hp,
          source,
        });
      }
    };

    // Helper: trigger AoE explosion across all alive enemies
    const triggerExplosion = (source, baseExplosionDamage, isFromJackpot = false) => {
      if (baseExplosionDamage <= 0 || stepCount >= MAX_CHAIN_STEPS) return;
      const alive = this.getAliveEnemies();
      if (alive.length === 0) return;

      stepCount += 1;
      const comboNow = incCombo();
      const explosionDmg = Math.max(1, baseExplosionDamage + this.turnChainScalingBonus);

      const targetsReport = [];
      const newlyKilled = [];

      for (const enemy of alive) {
        const prevHp = enemy.hp;
        const actualDmg = Math.max(1, explosionDmg + (enemy.vulnerable || 0));
        enemy.hp = Math.max(0, enemy.hp - actualDmg);
        totalDamageThisFire += actualDmg;

        const isKill = prevHp > 0 && enemy.hp === 0;
        const overkill = isKill ? Math.max(0, actualDmg - prevHp) : 0;
        if (isKill) {
          enemy.alive = false;
          newlyKilled.push({ enemy, overkill });
        }

        targetsReport.push({
          targetId: enemy.uid,
          damage: actualDmg,
          isKill,
          overkill,
          remainingHp: enemy.hp,
        });
      }

      events.push({
        type: 'EXPLOSION',
        source,
        damagePerEnemy: explosionDmg,
        targets: targetsReport,
        comboCount: comboNow,
      });

      // Chain scaling increments after an explosion lands
      if (this.hasRule('chain_scaling')) {
        this.turnChainScalingBonus += 2;
      }

      // Blast shield rule: gain +3 Guard whenever an explosion occurs
      if (this.hasRule('blast_shield') && stepCount < MAX_CHAIN_STEPS) {
        events.push({
          type: 'RULE_TRIGGER',
          ruleId: 'blast_shield',
          ruleName: FOUL_RULES.blast_shield.name,
          description: '爆発の爆風を吸収してガード+3獲得！',
          comboCount: this.turnComboCount,
        });
        gainGuard(3, '爆風バリア');
      }

      if (!isFromJackpot) {
        checkJackpot();
      }

      // Process deaths caused by this explosion
      for (const { enemy, overkill } of newlyKilled) {
        handleEnemyDeath(enemy, overkill, { fromDirectCombo: false });
      }
    };

    // Helper: handle enemy death and all death-triggered chain reactions!
    const handleEnemyDeath = (enemy, overkill = 0, { fromDirectCombo = false, explosionOnKill = 0, healOnKill = 0 } = {}) => {
      killsThisFire += 1;
      this.runState.stats.enemiesDefeated += 1;

      events.push({
        type: 'ENEMY_DEATH',
        targetId: enemy.uid,
        enemyName: enemy.name,
        comboCount: this.turnComboCount,
      });

      if (healOnKill > 0) {
        healPlayer(healOnKill, 'ドレイン改変（撃破吸収）');
      }

      // Card-based explosion on kill (e.g. Guillotine chop or Red Pen upgrade)
      if (explosionOnKill > 0 && canContinue()) {
        triggerExplosion(`${act.name}（撃破爆発）`, explosionOnKill);
      }

      // Enemy passive: Bomber Man explodes on death!
      if (enemy.deathExplosionEnemyDamage > 0 && stepCount < MAX_CHAIN_STEPS) {
        triggerExplosion(`${enemy.name}の道連れ大爆発！`, enemy.deathExplosionEnemyDamage);
      }

      // Rule: blood_alchemy (Heal 3 HP & permanent +2 attack for this battle)
      if (this.hasRule('blood_alchemy')) {
        this.permanentBattleDamageBonus += 2;
        events.push({
          type: 'RULE_TRIGGER',
          ruleId: 'blood_alchemy',
          ruleName: FOUL_RULES.blood_alchemy.name,
          description: `${enemy.name}撃破でHP+3回復＆戦闘中の基礎攻撃力+2！`,
          comboCount: this.turnComboCount,
        });
        healPlayer(3, '暴走アドレナリン');
      }

      // Rule: first_blood_nuke (First kill each turn triggers 12 AoE explosion)
      if (this.hasRule('first_blood_nuke') && !this.firstKillDoneThisTurn) {
        this.firstKillDoneThisTurn = true;
        if (canContinue()) {
          events.push({
            type: 'RULE_TRIGGER',
            ruleId: 'first_blood_nuke',
            ruleName: FOUL_RULES.first_blood_nuke.name,
            description: 'ターン最初の撃破！見せしめ12ダメージ特大爆発！！',
            comboCount: this.turnComboCount,
          });
          triggerExplosion('見せしめ大爆発', 12);
        }
      } else {
        this.firstKillDoneThisTurn = true;
      }

      // Rule: death_chain (Every enemy death triggers 7 AoE explosion)
      if (this.hasRule('death_chain') && canContinue()) {
        events.push({
          type: 'RULE_TRIGGER',
          ruleId: 'death_chain',
          ruleName: FOUL_RULES.death_chain.name,
          description: `${enemy.name}が死体爆弾化して全体7ダメージ爆発！`,
          comboCount: this.turnComboCount,
        });
        triggerExplosion('死体爆弾ルール', 7);
      }

      // Rule: overkill_transfer (100% of overkill damage leaps as lightning to another alive enemy!)
      if (this.hasRule('overkill_transfer') && overkill > 0 && canContinue()) {
        const nextAlive = this.getAliveEnemies();
        if (nextAlive.length > 0) {
          const transferTarget = nextAlive[0];
          const comboNow = incCombo();
          events.push({
            type: 'RULE_TRIGGER',
            ruleId: 'overkill_transfer',
            ruleName: FOUL_RULES.overkill_transfer.name,
            description: `余剰ダメージ${overkill}が${transferTarget.name}へ雷撃転嫁！`,
            comboCount: comboNow,
          });
          events.push({
            type: 'CHAIN_ATTACK',
            fromTargetId: enemy.uid,
            toTargetId: transferTarget.uid,
            reason: `余剰ダメージ転嫁 (${overkill})`,
            comboCount: comboNow,
          });
          applyDamageToEnemy(transferTarget, overkill, {
            source: '余剰ダメージ転嫁',
            isDirectAttack: false,
            pierceArmor: true,
            hitIndex: 1,
            totalHits: 1,
          });
          checkJackpot();
        }
      }

      return fromDirectCombo;
    };

    // Helper: apply single damage instance to a specific enemy
    const applyDamageToEnemy = (
      enemy,
      rawDamage,
      {
        source = act.name,
        isDirectAttack = true,
        pierceArmor = false,
        vulnOnHit = 0,
        explosionOnHit = 0,
        explosionOnKill = 0,
        guardOnHit = 0,
        healOnHit = 0,
        healOnKill = 0,
        splashDamage = 0,
        hitIndex = 1,
        totalHits = 1,
      } = {}
    ) => {
      if (!enemy || !enemy.alive || enemy.hp <= 0 || stepCount >= MAX_CHAIN_STEPS) {
        return { isKill: false, overkill: 0 };
      }

      stepCount += 1;
      const comboNow = incCombo();

      const armorReduction = !pierceArmor ? Math.max(0, enemy.armor || 0) : 0;
      const beforeBlock = Math.max(1, rawDamage + (enemy.vulnerable || 0) + this.turnChainScalingBonus);
      const blockedByArmor = Math.min(beforeBlock - 1, armorReduction);
      const finalDamage = Math.max(1, beforeBlock - blockedByArmor);

      const prevHp = enemy.hp;
      enemy.hp = Math.max(0, enemy.hp - finalDamage);
      totalDamageThisFire += finalDamage;

      const isKill = prevHp > 0 && enemy.hp === 0;
      const overkill = isKill ? Math.max(0, finalDamage - prevHp) : 0;
      if (isKill) {
        enemy.alive = false;
      }

      events.push({
        type: 'ATTACK_HIT',
        targetId: enemy.uid,
        damage: finalDamage,
        blockedByArmor,
        hitIndex,
        totalHits,
        comboCount: comboNow,
        isKill,
        overkill,
        source,
        remainingHp: enemy.hp,
      });

      // Apply vulnerability stack for subsequent hits
      if (vulnOnHit > 0 && enemy.alive) {
        enemy.vulnerable = (enemy.vulnerable || 0) + vulnOnHit;
      }

      // Chain scaling rule: each hit increases all turn damage by +2
      if (this.hasRule('chain_scaling')) {
        this.turnChainScalingBonus += 2;
      }

      // Guard on hit ('insurance' mod)
      if (guardOnHit > 0) {
        gainGuard(guardOnHit, '保険（命中ガード）');
      }

      // Heal on hit ('vampire' mod)
      if (healOnHit > 0) {
        healPlayer(healOnHit, 'ドレイン改変');
      }

      // Splash shockwave damage to other alive enemies ('tackle')
      if (splashDamage > 0 && canContinue()) {
        const others = this.getAliveEnemies().filter((e) => e.uid !== enemy.uid);
        for (const other of others) {
          if (stepCount >= MAX_CHAIN_STEPS) break;
          applyDamageToEnemy(other, splashDamage, {
            source: `${act.name}（衝撃波）`,
            isDirectAttack: false,
            pierceArmor: false,
            hitIndex: 1,
            totalHits: 1,
          });
        }
      }

      // Induce explosion on hit ('induce_explosion' or 'bomb_toss')
      if (explosionOnHit > 0 && stepCount < MAX_CHAIN_STEPS) {
        triggerExplosion('誘爆', explosionOnHit);
      }

      checkJackpot();

      // Enemy Counter-attack passive if still alive after a direct attack
      if (isDirectAttack && enemy.alive && enemy.hp > 0) {
        if (enemy.counterDamage > 0) {
          this._applyEnemyCounterToPlayer(enemy, enemy.counterDamage, events);
        }
        if (enemy.bossCounterEveryHits > 0) {
          enemy.hitsTakenCounter = (enemy.hitsTakenCounter || 0) + 1;
          if (enemy.hitsTakenCounter % enemy.bossCounterEveryHits === 0) {
            this._applyEnemyCounterToPlayer(enemy, enemy.bossCounterDamage || 5, events);
          }
        }
      }

      // Process kill and death triggers
      if (isKill) {
        handleEnemyDeath(enemy, overkill, {
          fromDirectCombo: isDirectAttack,
          explosionOnKill,
          healOnKill,
        });
      }

      return { isKill, overkill };
    };

    // Compile combo parameters from Action Card + Mod Cards
    let repeatCasts = 1;
    let targetMode = act.target || 'single';
    let hitsPerCast = act.hits || 1;
    let guardGainPerCast = act.guardGain || 0;
    let flatAdd = 0;
    let totalMultiplier = 1.0;
    let explosionOnHit = act.explosionOnHit || 0;
    let explosionOnKill = act.explosionOnKill || 0;
    let guardOnHit = 0;
    let pierceArmor = Boolean(act.armorPiercing);
    let vulnOnHit = 0;
    let encoreAllowance = 0;
    let healOnHit = 0;
    let healOnKill = 0;
    let addGuardRatio = act.guardDamageRatio || 0;
    let hasLowHpScaling = false;
    let maxLowHpMult = 3.0;
    let minLowHpMult = 1.25;

    for (const m of mods) {
      if (m.repeatCastAdd) repeatCasts += m.repeatCastAdd;
      if (m.overrideTarget === 'all') targetMode = 'all';
      if (m.hitsAdd) hitsPerCast += m.hitsAdd;
      if (m.guardGainOnCast) guardGainPerCast += m.guardGainOnCast;
      if (m.damageAdd) flatAdd += m.damageAdd;
      if (m.damageMultiplier && m.damageMultiplier !== 1) totalMultiplier *= m.damageMultiplier;
      if (m.explosionOnHitAdd) explosionOnHit += m.explosionOnHitAdd;
      if (m.explosionOnKillAdd) explosionOnKill += m.explosionOnKillAdd;
      if (m.guardOnHit) guardOnHit += m.guardOnHit;
      if (m.addGuardRatioToDamage) addGuardRatio += m.addGuardRatioToDamage;
      if (m.paybackMode) {
        const paybackBonus = Math.max(
          m.paybackMinBonus || 5,
          Math.round(this.damageTakenSinceLastTurn * (m.paybackMultiplier || 1.0))
        );
        flatAdd += paybackBonus;
      }
      if (m.lowHpScaling) {
        hasLowHpScaling = true;
        maxLowHpMult = Math.max(maxLowHpMult, m.maxLowHpMultiplier || 3.0);
        if (m.minLowHpMultiplier) minLowHpMult = Math.max(minLowHpMult, m.minLowHpMultiplier);
      }
      if (m.pierceArmor) pierceArmor = true;
      if (m.vulnOnHit) vulnOnHit += m.vulnOnHit;
      if (m.encoreOnKill) encoreAllowance += m.encoreCount || 1;
      if (m.healOnHit) healOnHit += m.healOnHit;
      if (m.healOnKill) healOnKill += m.healOnKill;
    }

    const crisisActive =
      this.hasRule('crisis_fury') && this.runState.hp <= Math.ceil(this.runState.maxHp * 0.5);
    if (crisisActive) {
      hitsPerCast += 1;
      totalMultiplier *= 1.5;
      events.push({
        type: 'RULE_TRIGGER',
        ruleId: 'crisis_fury',
        ruleName: FOUL_RULES.crisis_fury.name,
        description: 'HP50%以下！攻撃回数+1回＆威力1.5倍！！',
        comboCount: this.turnComboCount,
      });
    }

    // Queue of attack volleys (supports Repeat Casts + Encore on kill!)
    let remainingEncores = encoreAllowance * repeatCasts + 4; // Generous cap when chaining kills with Encore
    const hasEncoreMod = encoreAllowance > 0;

    const computeRawDamageForTarget = (targetEnemy) => {
      let base = (act.baseDamage || 0) + this.permanentBattleDamageBonus;
      if (addGuardRatio > 0) {
        base += Math.round(this.runState.guard * addGuardRatio);
      }
      if (act.missingHpDamageRatio) {
        const missingHp = Math.max(0, this.runState.maxHp - this.runState.hp);
        base += Math.round(missingHp * act.missingHpDamageRatio);
      }
      let mult = totalMultiplier;
      if (hasLowHpScaling && targetEnemy) {
        const enemyRatio = targetEnemy.hp / targetEnemy.maxHp;
        const playerRatio = this.runState.hp / this.runState.maxHp;
        const lowestRatio = Math.min(enemyRatio, playerRatio);
        const dynMult = minLowHpMult + (1 - lowestRatio) * (maxLowHpMult - minLowHpMult);
        mult *= Math.min(maxLowHpMult, Math.max(minLowHpMult, dynMult));
      }
      return Math.max(1, Math.round((base + flatAdd) * mult));
    };

    const executeVolley = (preferredTargetId, isEncoreVolley = false) => {
      if (!canContinue()) return;

      if (guardGainPerCast > 0) {
        gainGuard(guardGainPerCast, isEncoreVolley ? `${act.name}（おかわり）` : act.name);
      }

      let killedAnyInVolley = false;
      let lastKilledEnemyId = null;

      for (let hitIdx = 1; hitIdx <= hitsPerCast; hitIdx++) {
        if (!canContinue()) break;

        let targets = [];
        if (targetMode === 'all') {
          targets = this.getAliveEnemies();
        } else {
          let single = this.getAliveEnemies().find((e) => e.uid === preferredTargetId);
          if (!single) {
            // Auto-retarget to another living enemy if primary died mid-combo!
            single = this.getAliveEnemies()[0];
          }
          if (single) targets = [single];
        }

        for (const target of targets) {
          if (!target.alive || stepCount >= MAX_CHAIN_STEPS) continue;
          const rawDmg = computeRawDamageForTarget(target);
          const { isKill } = applyDamageToEnemy(target, rawDmg, {
            source: isEncoreVolley ? `${act.name}（おかわり）` : act.name,
            isDirectAttack: true,
            pierceArmor,
            vulnOnHit,
            explosionOnHit,
            explosionOnKill,
            guardOnHit,
            healOnHit,
            healOnKill,
            splashDamage: act.splashDamage || 0,
            hitIndex: hitIdx,
            totalHits: hitsPerCast,
          });

          if (isKill) {
            killedAnyInVolley = true;
            lastKilledEnemyId = target.uid;
          }
        }
      }

      // If 'encore' mod is equipped and we killed an enemy, chain a full Encore volley onto a surviving enemy!
      if (hasEncoreMod && killedAnyInVolley && remainingEncores > 0 && canContinue()) {
        remainingEncores -= 1;
        const nextSurvivors = this.getAliveEnemies();
        if (nextSurvivors.length > 0) {
          const nextTarget = nextSurvivors[0];
          events.push({
            type: 'CHAIN_ATTACK',
            fromTargetId: lastKilledEnemyId,
            toTargetId: nextTarget.uid,
            reason: 'おかわり発動！別ターゲットへ追加コンボ！',
            comboCount: this.turnComboCount,
          });
          executeVolley(nextTarget.uid, true);
        }
      }
    };

    // Execute all repeat casts
    for (let castIdx = 0; castIdx < repeatCasts; castIdx++) {
      if (!canContinue()) break;
      executeVolley(targetEnemyId, false);
    }

    // Update run & meta records
    this.runState.stats.totalDamageDealt += totalDamageThisFire;
    if (this.turnComboCount > this.runState.stats.maxComboInRun) {
      this.runState.stats.maxComboInRun = this.turnComboCount;
    }
    if (totalDamageThisFire > this.runState.stats.maxTurnDamageInRun) {
      this.runState.stats.maxTurnDamageInRun = totalDamageThisFire;
    }

    // Check victory/defeat
    if (this.getAliveEnemies().length === 0) {
      this.isBattleOver = true;
      this.result = 'victory';
      this.runState.stats.floorsCleared += 1;
    } else if (this.runState.hp <= 0) {
      this.isBattleOver = true;
      this.result = 'defeat';
    }

    MetaProgression.recordBattleStats({
      combo: this.turnComboCount,
      turnDamage: totalDamageThisFire,
      kills: killsThisFire,
      score: this.runState.stats.totalDamageDealt + this.runState.stats.maxComboInRun * 25,
      victory: this.result === 'victory' && this.area === 3 && this.nodeType === 'boss',
    });

    events.push({
      type: 'COMBO_END',
      totalCombo: this.turnComboCount,
      totalDamage: totalDamageThisFire,
      kills: killsThisFire,
      isVictory: this.result === 'victory',
    });

    return events;
  }

  _applyEnemyCounterToPlayer(enemy, counterDmg, events) {
    const blocked = Math.min(this.runState.guard, counterDmg);
    const unblocked = Math.max(0, counterDmg - blocked);
    this.runState.guard -= blocked;
    this.runState.hp = Math.max(0, this.runState.hp - unblocked);
    this.damageTakenSinceLastTurn += unblocked;

    events.push({
      type: 'ENEMY_COUNTER',
      enemyId: enemy.uid,
      enemyName: enemy.name,
      damageToPlayer: unblocked,
      blockedByGuard: blocked,
      playerHp: this.runState.hp,
      playerGuard: this.runState.guard,
    });
  }

  // ==========================================================================
  // ENEMY TURN EXECUTION
  // ==========================================================================

  /**
   * Executes the enemy turn for all surviving enemies, emitting timeline events:
   * - ENEMY_ATTACK
   * - ENEMY_SUMMON
   * - ENEMY_BUFF
   * - THORNS_TRIGGER (when player has 'thorns_revenge' equipped)
   * - ENEMY_DEATH (if thorns kills an attacking enemy)
   * Then advances the turn and draws a fresh player hand.
   */
  executeEnemyTurn() {
    const events = [];
    if (this.isBattleOver) return events;

    // Reset damageTakenSinceLastTurn before tracking this enemy turn's hits
    this.damageTakenSinceLastTurn = 0;

    const actingEnemies = [...this.getAliveEnemies()];

    for (const enemy of actingEnemies) {
      if (!enemy.alive || enemy.hp <= 0 || this.runState.hp <= 0) continue;

      const intent = this.getCurrentIntent(enemy);
      enemy.intentIndex = (enemy.intentIndex + 1) % enemy.intents.length;

      const hits = intent.hits || 1;
      const dmgPerHit = intent.damage || 0;

      // 1. Handle attack component if damage > 0
      if (dmgPerHit > 0) {
        for (let h = 0; h < hits; h++) {
          if (this.runState.hp <= 0 || !enemy.alive) break;
          const blocked = Math.min(this.runState.guard, dmgPerHit);
          const unblocked = Math.max(0, dmgPerHit - blocked);
          this.runState.guard -= blocked;
          this.runState.hp = Math.max(0, this.runState.hp - unblocked);
          this.damageTakenSinceLastTurn += unblocked;

          events.push({
            type: 'ENEMY_ATTACK',
            enemyId: enemy.uid,
            enemyName: enemy.name,
            intentLabel: intent.label,
            damageToPlayer: unblocked,
            blockedByGuard: blocked,
            hitIndex: h + 1,
            totalHits: hits,
            playerHp: this.runState.hp,
            playerGuard: this.runState.guard,
          });

          // Check 'thorns_revenge' foul rule!
          if (this.hasRule('thorns_revenge') && enemy.alive) {
            const thornsDirect = 8;
            const thornsAoE = 4;
            enemy.hp = Math.max(0, enemy.hp - thornsDirect);
            const killedAttacker = enemy.hp === 0;
            if (killedAttacker) enemy.alive = false;

            events.push({
              type: 'THORNS_TRIGGER',
              ruleId: 'thorns_revenge',
              ruleName: FOUL_RULES.thorns_revenge.name,
              attackerId: enemy.uid,
              attackerName: enemy.name,
              directDamage: thornsDirect,
              aoeDamage: thornsAoE,
              isKill: killedAttacker,
            });

            if (killedAttacker) {
              events.push({
                type: 'ENEMY_DEATH',
                targetId: enemy.uid,
                enemyName: enemy.name,
                comboCount: 1,
              });
            }

            // AoE 4 explosion to all surviving enemies
            for (const other of this.getAliveEnemies()) {
              other.hp = Math.max(0, other.hp - thornsAoE);
              if (other.hp === 0) {
                other.alive = false;
                events.push({
                  type: 'ENEMY_DEATH',
                  targetId: other.uid,
                  enemyName: other.name,
                  comboCount: 1,
                });
              }
            }
          }
        }
      }

      // 2. Handle buff/charge component
      if (intent.type === 'guard_buff' && enemy.alive) {
        const armorAdd = intent.armorAdd || 1;
        enemy.armor = (enemy.armor || 0) + armorAdd;
        events.push({
          type: 'ENEMY_BUFF',
          enemyId: enemy.uid,
          enemyName: enemy.name,
          armorAdd,
          newArmor: enemy.armor,
          label: intent.label,
        });
      } else if (intent.type === 'charge' && dmgPerHit === 0 && enemy.alive) {
        events.push({
          type: 'ENEMY_BUFF',
          enemyId: enemy.uid,
          enemyName: enemy.name,
          armorAdd: 0,
          newArmor: enemy.armor,
          label: intent.label,
        });
      }

      // 3. Handle summon component (if space in arena: max 4 alive enemies)
      const summonId = intent.summonId || enemy.summonOnTurnEnd;
      if (summonId && enemy.alive && this.getAliveEnemies().length < 4) {
        const spawned = this._createEnemyInstance(summonId, this.enemies.length);
        this.enemies.push(spawned);
        events.push({
          type: 'ENEMY_SUMMON',
          summonerId: enemy.uid,
          summonerName: enemy.name,
          spawnedEnemy: structuredClone(spawned),
        });
      }
    }

    // Check victory (from thorns) or defeat
    if (this.runState.hp <= 0) {
      this.isBattleOver = true;
      this.result = 'defeat';
    } else if (this.getAliveEnemies().length === 0) {
      this.isBattleOver = true;
      this.result = 'victory';
      this.runState.stats.floorsCleared += 1;
    } else {
      // Advance to next player turn; decay player guard by 50% so fortress builds retain partial guard
      this.turn += 1;
      this.runState.guard = Math.floor(this.runState.guard * 0.5);
      this.startPlayerTurn();
    }

    return events;
  }
}
