/**
 * 『反則上等！』 (Hansoku Joto!) — Main Game Controller & UI/3D/Audio Orchestrator
 */

import confetti from 'canvas-confetti';
import {
  STARTER_LOADOUTS,
  ACTION_CARDS,
  MOD_CARDS,
  FOUL_RULES,
  AREA_CONFIGS,
  MYSTERY_EVENTS,
  MetaProgression,
  RunState,
  CombatEngine,
  getRedPenUpgrades,
} from './engine.js';
import { Arena3D } from './arena3d.js';
import { sound } from './audio.js';

class HansokuJotoApp {
  constructor() {
    this.selectedLoadoutId = 'brawler';
    this.runState = null;
    this.combat = null;
    this.arena = null;

    // Currently slotted cards in combat
    this.slottedActionCard = null; // null means use bare_punch
    this.slottedModCards = [null, null, null];
    this.selectedTargetId = null;

    // Playback speed & state
    this.isAnimating = false;
    this.skipRequested = false;
    this.speedMode = 1; // 1 = 1x, 2 = 2x, 3 = Instant/Fast

    // Red Pen Workshop selection state
    this.selectedRedPenCardUid = null;

    // Current shop inventory
    this.currentShopInventory = null;

    // Guided Interactive Tutorial State
    this.tutorialActive = false;
    this.tutorialDismissed = false;

    this._initDOMRefs();
    this._initArena3D();
    this._bindEvents();
    this._renderTitleScreen();
    this._startHudPositionLoop();
  }

  _initDOMRefs() {
    this.el = {
      arenaContainer: document.getElementById('arena-container'),
      fxOverlay: document.getElementById('fx-overlay'),
      enemyHudLayer: document.getElementById('enemy-hud-layer'),
      damagePopupLayer: document.getElementById('damage-popup-layer'),

      // Top bar
      topBar: document.getElementById('top-bar'),
      hudAreaBadge: document.getElementById('hud-area-badge'),
      hudNodeName: document.getElementById('hud-node-name'),
      hudHpFill: document.getElementById('hud-hp-fill'),
      hudHpText: document.getElementById('hud-hp-text'),
      hudGuardText: document.getElementById('hud-guard-text'),
      hudGoldText: document.getElementById('hud-gold-text'),
      hudRedpenCount: document.getElementById('hud-redpen-count'),
      hudFoulRules: document.getElementById('hud-foul-rules'),
      hudDeckCount: document.getElementById('hud-deck-count'),
      hudRulesCount: document.getElementById('hud-rules-count'),
      btnOpenRedpen: document.getElementById('btn-open-redpen'),
      btnOpenManualHud: document.getElementById('btn-open-manual-hud'),
      btnStartTutorialHud: document.getElementById('btn-start-tutorial-hud'),
      btnDeckView: document.getElementById('btn-deck-view'),
      btnRulesManage: document.getElementById('btn-rules-manage'),
      btnSpeedToggle: document.getElementById('btn-speed-toggle'),
      btnBgmToggle: document.getElementById('btn-bgm-toggle'),
      btnSfxToggle: document.getElementById('btn-sfx-toggle'),

      // Combo banner
      comboBanner: document.getElementById('combo-counter-banner'),
      comboCountNum: document.getElementById('combo-count-num'),
      comboTotalDmg: document.getElementById('combo-total-dmg'),
      comboRuleToast: document.getElementById('combo-active-rule-toast'),
      btnSkipPlayback: document.getElementById('btn-skip-playback'),
      bossCutinBanner: document.getElementById('boss-cutin-banner'),
      bossCutinTitle: document.getElementById('boss-cutin-title'),

      // Tutorial banner
      tutorialBanner: document.getElementById('tutorial-banner'),
      tutorialStepBadge: document.getElementById('tutorial-step-badge'),
      tutorialTitle: document.getElementById('tutorial-title'),
      tutorialText: document.getElementById('tutorial-text'),
      btnTutorialManual: document.getElementById('btn-tutorial-manual'),
      btnCloseTutorial: document.getElementById('btn-close-tutorial'),

      // Combat bottom UI
      combatUi: document.getElementById('combat-ui'),
      slotAction: document.getElementById('slot-action'),
      slotMod0: document.getElementById('slot-mod-0'),
      slotMod1: document.getElementById('slot-mod-1'),
      slotMod2: document.getElementById('slot-mod-2'),
      slotGroupMod2: document.getElementById('slot-group-mod-2'),
      btnUseBarePunch: document.getElementById('btn-use-bare-punch'),
      previewTargetBadge: document.getElementById('preview-target-badge'),
      previewFormulaText: document.getElementById('preview-formula-text'),
      previewSynergiesList: document.getElementById('preview-synergies-list'),
      btnClearSlots: document.getElementById('btn-clear-slots'),
      btnFireCombo: document.getElementById('btn-fire-combo'),
      handContainer: document.getElementById('hand-container'),
      hudDrawCount: document.getElementById('hud-draw-count'),
      hudDiscardCount: document.getElementById('hud-discard-count'),
      btnDrawPile: document.getElementById('btn-draw-pile'),
      btnDiscardPile: document.getElementById('btn-discard-pile'),

      // Title screen
      titleScreen: document.getElementById('title-screen'),
      starterSelection: document.getElementById('starter-selection'),
      btnStartTutorialRun: document.getElementById('btn-start-tutorial-run'),
      btnStartRun: document.getElementById('btn-start-run'),
      btnQuickDemoCombo: document.getElementById('btn-quick-demo-combo'),
      btnOpenManualTitle: document.getElementById('btn-open-manual-title'),
      recordMaxCombo: document.getElementById('record-max-combo'),
      recordMaxDmg: document.getElementById('record-max-dmg'),
      recordWins: document.getElementById('record-wins'),
      btnTitleBgm: document.getElementById('btn-title-bgm'),
      btnTitleSfx: document.getElementById('btn-title-sfx'),

      // Manual modal
      manualModal: document.getElementById('manual-modal'),
      manualTabs: document.getElementById('manual-tabs'),
      btnManualStartTutorial: document.getElementById('btn-manual-start-tutorial'),
      btnCloseManual: document.getElementById('btn-close-manual'),

      // Map screen
      mapScreen: document.getElementById('map-screen'),
      mapAreaKicker: document.getElementById('map-area-kicker'),
      mapAreaTitle: document.getElementById('map-area-title'),
      mapAreaDesc: document.getElementById('map-area-desc'),
      mapRedpenCount: document.getElementById('map-redpen-count'),
      mapTrackContainer: document.getElementById('map-track-container'),
      btnMapManual: document.getElementById('btn-map-manual'),
      btnMapRedpen: document.getElementById('btn-map-redpen'),
      btnMapRules: document.getElementById('btn-map-rules'),
      btnMapDeck: document.getElementById('btn-map-deck'),

      // Reward screen
      rewardScreen: document.getElementById('reward-screen'),
      rewardTitle: document.getElementById('reward-title'),
      rewardSummaryText: document.getElementById('reward-summary-text'),
      rewardBonusStrip: document.getElementById('reward-bonus-strip'),
      rewardCardsContainer: document.getElementById('reward-cards-container'),
      btnRewardRedpenNow: document.getElementById('btn-reward-redpen-now'),
      btnSkipCardReward: document.getElementById('btn-skip-card-reward'),

      // Red Pen modal
      redpenModal: document.getElementById('redpen-modal'),
      redpenModalStock: document.getElementById('redpen-modal-stock'),
      redpenDeckGrid: document.getElementById('redpen-deck-grid'),
      redpenOptionsContainer: document.getElementById('redpen-options-container'),
      btnCloseRedpen: document.getElementById('btn-close-redpen'),

      // Utility modal
      utilityModal: document.getElementById('utility-modal'),
      utilityModalKicker: document.getElementById('utility-modal-kicker'),
      utilityModalTitle: document.getElementById('utility-modal-title'),
      utilityModalBody: document.getElementById('utility-modal-body'),
      btnCloseUtility: document.getElementById('btn-close-utility'),

      // Gameover / Victory screen
      gameoverScreen: document.getElementById('gameover-screen'),
      gameoverKicker: document.getElementById('gameover-kicker'),
      gameoverTitle: document.getElementById('gameover-title'),
      gameoverDesc: document.getElementById('gameover-desc'),
      gameoverStatsGrid: document.getElementById('gameover-stats-grid'),
      btnPlayAgain: document.getElementById('btn-play-again'),
      btnEndlessContinue: document.getElementById('btn-endless-continue'),
    };
  }

  _initArena3D() {
    this.arena = new Arena3D(this.el.arenaContainer, {
      onSelectEnemy: (enemyId) => {
        if (this.isAnimating) return;
        this.selectedTargetId = enemyId;
        sound.playCardSelect();
        this._sync3DEnemies();
        this._updateComboPreview();
      },
    });
    // Spawn decorative preview enemies in the background while on title screen
    this.arena.syncEnemies(
      [
        { id: 'demo_1', name: 'サンドバッグ', hp: 20, maxHp: 20, modelType: 'sandbag_jr' },
        { id: 'demo_2', name: 'ボンバーマン', hp: 20, maxHp: 20, modelType: 'bomber_man' },
      ],
      'demo_1'
    );
  }

  _bindEvents() {
    // Start Run buttons
    if (this.el.btnStartTutorialRun) {
      this.el.btnStartTutorialRun.addEventListener('click', () => {
        sound.playLaunch();
        this.tutorialActive = true;
        this.tutorialDismissed = false;
        this.startNewRun(this.selectedLoadoutId, false, true);
      });
    }

    this.el.btnStartRun.addEventListener('click', () => {
      sound.playLaunch();
      this.tutorialActive = true;
      this.tutorialDismissed = false;
      this.startNewRun(this.selectedLoadoutId, false, false);
    });

    this.el.btnQuickDemoCombo.addEventListener('click', () => {
      sound.playLaunch();
      this.tutorialActive = true;
      this.tutorialDismissed = false;
      this.startNewRun(this.selectedLoadoutId, true, false);
    });

    // Player Manual (説明書) Modal handlers
    const openManual = () => {
      sound.playCardSelect();
      this.openManualModal();
    };
    if (this.el.btnOpenManualTitle) this.el.btnOpenManualTitle.addEventListener('click', openManual);
    if (this.el.btnOpenManualHud) this.el.btnOpenManualHud.addEventListener('click', openManual);
    if (this.el.btnMapManual) this.el.btnMapManual.addEventListener('click', openManual);
    if (this.el.btnTutorialManual) this.el.btnTutorialManual.addEventListener('click', openManual);

    if (this.el.btnCloseManual) {
      this.el.btnCloseManual.addEventListener('click', () => {
        sound.playCardSelect();
        this.el.manualModal.classList.add('hidden');
      });
    }

    if (this.el.btnManualStartTutorial) {
      this.el.btnManualStartTutorial.addEventListener('click', () => {
        sound.playLaunch();
        this.el.manualModal.classList.add('hidden');
        this.tutorialActive = true;
        this.tutorialDismissed = false;
        if (!this.combat || this.combat.isBattleOver) {
          this.startNewRun(this.selectedLoadoutId, false, true);
        } else {
          this._updateTutorialGuide();
        }
      });
    }

    if (this.el.manualTabs) {
      const tabBtns = this.el.manualTabs.querySelectorAll('.manual-tab-btn');
      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          sound.playCardSelect();
          const targetId = btn.dataset.tab;
          tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
          const contents = this.el.manualModal.querySelectorAll('.manual-tab-content');
          contents.forEach((c) => c.classList.toggle('active', c.id === targetId));
        });
      });
    }

    if (this.el.btnStartTutorialHud) {
      this.el.btnStartTutorialHud.addEventListener('click', () => {
        sound.playCardSelect();
        this.tutorialActive = true;
        this.tutorialDismissed = false;
        this._updateTutorialGuide();
      });
    }

    // Audio toggles
    const syncAudioBtns = () => {
      this.el.btnBgmToggle.textContent = sound.bgmEnabled ? '🎵' : '🔇';
      this.el.btnSfxToggle.textContent = sound.sfxEnabled ? '🔊' : '🔈';
      this.el.btnTitleBgm.textContent = `🎵 BGM: ${sound.bgmEnabled ? 'ON' : 'OFF'}`;
      this.el.btnTitleSfx.textContent = `🔊 SE: ${sound.sfxEnabled ? 'ON' : 'OFF'}`;
    };
    syncAudioBtns();

    const handleBgmToggle = () => {
      sound.toggleBGM();
      syncAudioBtns();
    };
    const handleSfxToggle = () => {
      sound.toggleSFX();
      syncAudioBtns();
    };

    this.el.btnBgmToggle.addEventListener('click', handleBgmToggle);
    this.el.btnTitleBgm.addEventListener('click', handleBgmToggle);
    this.el.btnSfxToggle.addEventListener('click', handleSfxToggle);
    this.el.btnTitleSfx.addEventListener('click', handleSfxToggle);

    // Speed toggle
    this.el.btnSpeedToggle.addEventListener('click', () => {
      this.speedMode = this.speedMode === 1 ? 2 : this.speedMode === 2 ? 3 : 1;
      const labels = { 1: '⚡ 1x', 2: '⚡⚡ 2x', 3: '⏭️ 爆速' };
      this.el.btnSpeedToggle.textContent = labels[this.speedMode];
      sound.playCardSelect();
    });

    // Skip current playback
    this.el.btnSkipPlayback.addEventListener('click', () => {
      this.skipRequested = true;
    });

    // Close tutorial
    this.el.btnCloseTutorial.addEventListener('click', () => {
      this.tutorialActive = false;
      this.tutorialDismissed = true;
      this.el.tutorialBanner.classList.add('hidden');
      this._clearTutorialHighlights();
    });

    // Bare punch button & slot click handlers
    this.el.btnUseBarePunch.addEventListener('click', () => {
      if (this.isAnimating) return;
      this.slottedActionCard = null;
      sound.playCardSelect();
      this._renderCombatCardsAndSlots();
    });

    this.el.slotAction.addEventListener('click', () => {
      if (this.isAnimating) return;
      if (this.slottedActionCard) {
        this.slottedActionCard = null;
        sound.playCardSelect();
        this._renderCombatCardsAndSlots();
      }
    });

    [this.el.slotMod0, this.el.slotMod1, this.el.slotMod2].forEach((slotEl, idx) => {
      slotEl.addEventListener('click', () => {
        if (this.isAnimating) return;
        if (this.slottedModCards[idx]) {
          this.slottedModCards[idx] = null;
          sound.playCardSelect();
          this._renderCombatCardsAndSlots();
        }
      });
    });

    this.el.btnClearSlots.addEventListener('click', () => {
      if (this.isAnimating) return;
      this.slottedActionCard = null;
      this.slottedModCards = [null, null, null];
      sound.playCardSelect();
      this._renderCombatCardsAndSlots();
    });

    // FIRE COMBO BUTTON!
    this.el.btnFireCombo.addEventListener('click', () => {
      if (this.isAnimating || !this.combat || this.combat.isBattleOver) return;
      this._handleFireCombo();
    });

    // Top bar & Map buttons for Red Pen, Rules, Deck
    const openRedPen = () => {
      if (this.isAnimating) return;
      sound.playCardSelect();
      this.openRedPenWorkshop();
    };
    this.el.btnOpenRedpen.addEventListener('click', openRedPen);
    this.el.btnMapRedpen.addEventListener('click', openRedPen);
    this.el.btnRewardRedpenNow.addEventListener('click', openRedPen);

    this.el.btnCloseRedpen.addEventListener('click', () => {
      this.el.redpenModal.classList.add('hidden');
      this._updateTopHud();
      if (this.combat && !this.combat.isBattleOver) {
        this._renderCombatCardsAndSlots();
      }
    });

    const openDeckModal = () => {
      if (this.isAnimating) return;
      sound.playCardSelect();
      this.openDeckViewerModal();
    };
    this.el.btnDeckView.addEventListener('click', openDeckModal);
    this.el.btnMapDeck.addEventListener('click', openDeckModal);
    this.el.btnDrawPile.addEventListener('click', openDeckModal);
    this.el.btnDiscardPile.addEventListener('click', openDeckModal);

    const openRulesModal = () => {
      if (this.isAnimating) return;
      sound.playCardSelect();
      this.openFoulRulesModal();
    };
    this.el.btnRulesManage.addEventListener('click', openRulesModal);
    this.el.btnMapRules.addEventListener('click', openRulesModal);

    this.el.btnCloseUtility.addEventListener('click', () => {
      this.el.utilityModal.classList.add('hidden');
      this._updateTopHud();
      if (this.combat && !this.combat.isBattleOver) {
        this._updateComboPreview();
      }
    });

    this.el.btnSkipCardReward.addEventListener('click', () => {
      if (!this.runState) return;
      this.runState.gold += 15;
      sound.playCardSelect();
      this._proceedAfterBattleReward();
    });

    this.el.btnPlayAgain.addEventListener('click', () => {
      sound.playCardSelect();
      this.el.gameoverScreen.classList.add('hidden');
      this._renderTitleScreen();
      this.el.titleScreen.classList.remove('hidden');
    });
  }

  // ==========================================================================
  // TITLE SCREEN & RUN INITIALIZATION
  // ==========================================================================

  _renderTitleScreen() {
    const meta = MetaProgression.load();
    this.el.recordMaxCombo.textContent = meta.maxComboRecord || 0;
    this.el.recordMaxDmg.textContent = meta.maxTurnDamageRecord || 0;
    if (this.el.recordWins) this.el.recordWins.textContent = meta.totalVictories || 0;

    const shortStyleLabels = {
      brawler: '💥 爆発番長',
      speedster: '⚡ 超連打',
      fortress: '🛡️ 倍返し要塞',
    };
    const shortStyleSummaries = {
      brawler: '敵を倒すたび全体7DMG爆発！王道の爽快連鎖スタイル',
      speedster: '当たるたび全威力+2上昇！手数で圧倒するマシンガンスタイル',
      fortress: 'ガード獲得ごとに自動砲撃！防御を火力に変えるカウンタースタイル',
    };

    this.el.starterSelection.innerHTML = '';
    Object.values(STARTER_LOADOUTS).forEach((loadout) => {
      const btn = document.createElement('button');
      const isActive = this.selectedLoadoutId === loadout.id;
      btn.className = `starter-pill-btn ${isActive ? 'active' : ''}`;
      btn.innerHTML = `
        <span class="starter-pill-icon">${loadout.icon || '🥊'}</span>
        <span>${shortStyleLabels[loadout.id] || loadout.name}</span>
      `;

      btn.addEventListener('click', () => {
        this.selectedLoadoutId = loadout.id;
        sound.playCardSelect();
        this._renderTitleScreen();
      });

      this.el.starterSelection.appendChild(btn);
    });

    const summaryEl = document.getElementById('starter-active-summary');
    if (summaryEl) {
      summaryEl.textContent =
        shortStyleSummaries[this.selectedLoadoutId] ||
        STARTER_LOADOUTS[this.selectedLoadoutId]?.subtitle ||
        '';
    }
  }

  openManualModal() {
    if (this.el.manualModal) {
      this.el.manualModal.classList.remove('hidden');
    }
  }

  _clearTutorialHighlights() {
    document.querySelectorAll('.tutorial-highlight-pulse').forEach((el) => {
      el.classList.remove('tutorial-highlight-pulse');
    });
  }

  _updateTutorialGuide() {
    this._clearTutorialHighlights();

    if (!this.tutorialActive || this.tutorialDismissed || !this.combat || this.combat.isBattleOver) {
      if (this.el.tutorialBanner) this.el.tutorialBanner.classList.add('hidden');
      return;
    }

    this.el.tutorialBanner.classList.remove('hidden');

    const hasAction = Boolean(this.slottedActionCard);
    const slottedModsCount = this.slottedModCards.filter(Boolean).length;
    const handCards = Array.from(this.el.handContainer.querySelectorAll('.game-card:not(.selected-in-hand)'));
    const handActions = handCards.filter((el) => el.classList.contains('action-card'));
    const handMods = handCards.filter((el) => el.classList.contains('mod-card'));

    if (!hasAction && handActions.length > 0) {
      if (this.el.tutorialStepBadge) this.el.tutorialStepBadge.textContent = 'STEP 1';
      if (this.el.tutorialTitle) {
        this.el.tutorialTitle.textContent = '光っている【黄色カード】を1枚タップ！';
      }
      handActions.forEach((el) => el.classList.add('tutorial-highlight-pulse'));
    } else if (slottedModsCount === 0 && handMods.length > 0) {
      if (this.el.tutorialStepBadge) this.el.tutorialStepBadge.textContent = 'STEP 2';
      if (this.el.tutorialTitle) {
        this.el.tutorialTitle.textContent = '光っている【青色カード】をタップして重ねよう！';
      }
      handMods.forEach((el) => el.classList.add('tutorial-highlight-pulse'));
    } else if (slottedModsCount === 1 && handMods.length > 0) {
      if (this.el.tutorialStepBadge) this.el.tutorialStepBadge.textContent = 'STEP 3';
      if (this.el.tutorialTitle) {
        this.el.tutorialTitle.textContent = 'もう1枚【青色カード】を重ねよう！（そのまま発射もOK）';
      }
      handMods.forEach((el) => el.classList.add('tutorial-highlight-pulse'));
    } else {
      if (this.el.tutorialStepBadge) this.el.tutorialStepBadge.textContent = 'FINISH';
      if (this.el.tutorialTitle) {
        this.el.tutorialTitle.textContent = '右下の『🔥 発射！』をタップして連鎖発動！';
      }
      if (this.el.btnFireCombo) {
        this.el.btnFireCombo.classList.add('tutorial-highlight-pulse');
      }
    }
  }

  startNewRun(loadoutId = 'brawler', boostedDemo = false, isGuidedTutorial = false) {
    this.runState = new RunState(loadoutId);

    if (isGuidedTutorial) {
      // Guided Tutorial ensures a super clear, fun first hand and +2 Red Pens to experiment with!
      this.runState.redPens = Math.max(2, this.runState.redPens + 1);
      this.tutorialActive = true;
      this.tutorialDismissed = false;
    }

    if (boostedDemo) {
      // Boosted Demo Mode: starts with extra Red Pens, both Death Chain + Blast Shield / Chain Scaling rules, and extra Explosive mods!
      this.runState.redPens += 2;
      this.runState.gold += 80;
      this.runState.unlockAndEquipRule('death_chain');
      this.runState.unlockAndEquipRule('chain_scaling');
      const bonusTriple = this.runState.addCardToDeck('triple_hit');
      const opts = getRedPenUpgrades(bonusTriple);
      if (opts[0]) {
        this.runState.rewriteCardWithRedPen(bonusTriple.uid, opts[0].id, false);
      }
      this.runState.addCardToDeck('induce_explosion');
    }

    this.el.titleScreen.classList.add('hidden');
    this.el.gameoverScreen.classList.add('hidden');
    this.el.topBar.classList.remove('hidden');

    sound.startBGM('planning');

    // Immediately select the first battle node of Area 1 so the player jumps right into explosive combat!
    const firstNodes = this.runState.getAvailableNextNodes();
    if (firstNodes.length > 0) {
      this._enterMapNode(firstNodes[0].id);
    } else {
      this.showMapScreen();
    }
  }

  // ==========================================================================
  // ROUTE MAP & NODE DISPATCH
  // ==========================================================================

  showMapScreen() {
    this.combat = null;
    this.el.combatUi.classList.add('hidden');
    this.el.rewardScreen.classList.add('hidden');
    this.el.tutorialBanner.classList.add('hidden');
    this._clearTutorialHighlights();
    this.el.enemyHudLayer.innerHTML = '';

    this._updateTopHud();
    sound.setBGMMode('planning');

    const map = this.runState.getCurrentAreaMap();
    const availableNodes = this.runState.getAvailableNextNodes();
    const availableIds = new Set(availableNodes.map((n) => n.id));
    const completedIds = new Set(this.runState.completedNodeIds);

    this.el.mapAreaKicker.textContent = `AREA ${this.runState.currentArea} / 3`;
    this.el.mapAreaTitle.textContent = map.name;
    this.el.mapAreaDesc.textContent = map.subtitle;
    this.el.mapRedpenCount.textContent = this.runState.redPens;

    this.el.mapTrackContainer.innerHTML = '';

    map.steps.forEach((stepNodes, stepIdx) => {
      const row = document.createElement('div');
      const isCurrentStep = stepNodes.some((n) => availableIds.has(n.id));
      const isPastStep = stepNodes.every((n) => completedIds.has(n.id)) && !isCurrentStep;

      row.className = `map-step-row ${isCurrentStep ? 'current-step' : ''} ${
        isPastStep ? 'completed-step' : ''
      }`;

      const stepBadge = document.createElement('div');
      stepBadge.className = 'step-index-badge';
      stepBadge.textContent = stepIdx === 4 ? 'BOSS' : `STEP ${stepIdx + 1}`;
      row.appendChild(stepBadge);

      const grid = document.createElement('div');
      grid.className = 'step-nodes-grid';

      stepNodes.forEach((node) => {
        const isSelectable = availableIds.has(node.id);
        const isVisited = completedIds.has(node.id);
        const btn = document.createElement('button');
        btn.className = `map-node-btn ${node.type === 'boss' ? 'boss-node' : ''}`;
        btn.disabled = !isSelectable;

        btn.innerHTML = `
          <div class="node-btn-top">
            <span>${node.icon}</span>
            <span>${node.title}</span>
            ${isVisited ? '<span style="color:#22c55e;font-size:0.75rem;">✔ 突破済</span>' : ''}
            ${isSelectable ? '<span style="color:#00e5ff;font-size:0.75rem;margin-left:auto;">▶ 進行可能</span>' : ''}
          </div>
          <div class="node-btn-desc">${node.subtitle}</div>
        `;

        if (isSelectable) {
          btn.addEventListener('click', () => {
            sound.playCardSelect();
            this.el.mapScreen.classList.add('hidden');
            this._enterMapNode(node.id);
          });
        }

        grid.appendChild(btn);
      });

      row.appendChild(grid);
      this.el.mapTrackContainer.appendChild(row);
    });

    this.el.mapScreen.classList.remove('hidden');
  }

  _enterMapNode(nodeId) {
    const node = this.runState.selectNode(nodeId);
    if (!node) return;

    this._updateTopHud();

    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
      this.startBattle(node);
    } else if (node.type === 'workshop') {
      // Grant +1 Red Pen and open Red Pen Workshop
      this.runState.redPens += 1;
      sound.playRedPenWrite();
      this._updateTopHud();
      this.openRedPenWorkshop(() => {
        this.showMapScreen();
      });
    } else if (node.type === 'shop') {
      this.openBlackMarketShop(() => {
        this.showMapScreen();
      });
    } else if (node.type === 'mystery') {
      this.openMysteryEventModal(() => {
        this.showMapScreen();
      });
    }
  }

  // ==========================================================================
  // COMBAT LOOP & 3-STEP COMBO ASSEMBLY
  // ==========================================================================

  startBattle(node) {
    this.combat = new CombatEngine(this.runState, { nodeType: node.type });
    this.slottedActionCard = null;
    this.slottedModCards = [null, null, null];

    const alive = this.combat.getAliveEnemies();
    this.selectedTargetId = alive[0] ? alive[0].uid : null;

    this.el.mapScreen.classList.add('hidden');
    this.el.rewardScreen.classList.add('hidden');
    this.el.combatUi.classList.remove('hidden');

    if (this.runState.stats.floorsCleared === 0 && !this.tutorialDismissed) {
      this.tutorialActive = true;
    }

    if (node.type === 'boss') {
      sound.setBGMMode('boss');
      if (this.el.bossCutinBanner) {
        const bossEnemy = alive.find((e) => e.isBoss) || alive[0];
        if (this.el.bossCutinTitle && bossEnemy) {
          this.el.bossCutinTitle.textContent = `${bossEnemy.name} 参戦！！`;
        }
        this.el.bossCutinBanner.classList.remove('hidden');
        setTimeout(() => {
          this.el.bossCutinBanner.classList.add('hidden');
        }, 2300);
      }
    } else {
      sound.setBGMMode('planning');
    }

    this._updateTopHud();
    this._sync3DEnemies();
    this._renderCombatCardsAndSlots();
  }

  _sync3DEnemies() {
    if (!this.combat || !this.arena) return;
    const alive = this.combat.getAliveEnemies();

    if (!this.selectedTargetId || !alive.some((e) => e.uid === this.selectedTargetId)) {
      this.selectedTargetId = alive[0] ? alive[0].uid : null;
    }

    const mapped = alive.map((e) => ({
      id: e.uid,
      name: e.name,
      hp: e.hp,
      maxHp: e.maxHp,
      modelType: e.modelType,
    }));

    this.arena.syncEnemies(mapped, this.selectedTargetId);
    this.arena.setPlayerGuard(this.runState.guard);
    this._renderEnemy2DHudCards();
  }

  _renderEnemy2DHudCards() {
    if (!this.combat) {
      this.el.enemyHudLayer.innerHTML = '';
      return;
    }

    const alive = this.combat.getAliveEnemies();
    this.el.enemyHudLayer.innerHTML = '';

    alive.forEach((enemy) => {
      const intent = this.combat.getCurrentIntent(enemy);
      const isTargeted = enemy.uid === this.selectedTargetId;
      const hpPercent = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)));

      const card = document.createElement('div');
      card.className = `enemy-hud-card ${isTargeted ? 'targeted' : ''}`;
      card.dataset.enemyId = enemy.uid;
      if (enemy.passiveDesc) {
        card.title = `${enemy.passiveName}: ${enemy.passiveDesc}`;
      }

      card.innerHTML = `
        <div class="enemy-name-row">
          <span>${isTargeted ? '<span class="enemy-target-tag">狙い</span>' : ''}${enemy.name}</span>
          ${enemy.armor > 0 ? `<span title="ダメージ軽減-${enemy.armor}">🛡️-${enemy.armor}</span>` : ''}
          ${enemy.vulnerable > 0 ? `<span style="color:#ff6b6b" title="被ダメージ+${enemy.vulnerable}">💔+${enemy.vulnerable}</span>` : ''}
        </div>
        <div class="enemy-hp-bar-outer">
          <div class="enemy-hp-bar-fill" style="width: ${hpPercent}%"></div>
          <div class="enemy-hp-text">${enemy.hp} / ${enemy.maxHp}</div>
        </div>
        <div class="enemy-intent-row">
          <span>次: ${intent.label}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (this.isAnimating) return;
        this.selectedTargetId = enemy.uid;
        sound.playCardSelect();
        this.arena.setSelectedEnemy(enemy.uid);
        this._renderEnemy2DHudCards();
        this._updateComboPreview();
      });

      this.el.enemyHudLayer.appendChild(card);
    });
  }

  _startHudPositionLoop() {
    const updatePositions = () => {
      if (this.arena && this.combat) {
        const screenMap = this.arena.getEnemyScreenPositions();
        const cards = Array.from(this.el.enemyHudLayer.querySelectorAll('.enemy-hud-card'));

        let topBarBottom = this.el.topBar ? this.el.topBar.getBoundingClientRect().bottom : 58;
        if (
          this.el.tutorialBanner &&
          !this.el.tutorialBanner.classList.contains('hidden')
        ) {
          this.el.tutorialBanner.style.top = `${Math.round(topBarBottom + 3)}px`;
          topBarBottom = this.el.tutorialBanner.getBoundingClientRect().bottom;
        }
        const combatTop =
          this.el.combatUi && !this.el.combatUi.classList.contains('hidden')
            ? this.el.combatUi.getBoundingClientRect().top
            : window.innerHeight - 60;

        const isMobile = window.innerWidth <= 640;
        const halfCardW = isMobile ? 58 : 88;
        const cardH = isMobile ? 54 : 76;
        const minY = Math.max(80, topBarBottom + cardH + 6);
        const maxY = Math.max(minY + 16, combatTop - 8);

        const items = [];
        cards.forEach((cardEl) => {
          const id = cardEl.dataset.enemyId;
          const pos = screenMap[id];
          if (pos && pos.visible) {
            const x = Math.max(halfCardW + 4, Math.min(window.innerWidth - halfCardW - 4, pos.x));
            const y = Math.max(minY, Math.min(maxY, pos.y));
            items.push({ cardEl, x, y });
          } else {
            cardEl.style.display = 'none';
          }
        });

        // Multi-pass anti-overlap separation so enemy HUD cards are always cleanly readable!
        items.sort((a, b) => a.x - b.x);
        const minSepX = isMobile ? 116 : 168;
        const minSepY = isMobile ? 52 : 76;

        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
              const a = items[i];
              const b = items[j];
              const dx = b.x - a.x;
              const dy = Math.abs(b.y - a.y);
              if (dx < minSepX && dy < minSepY) {
                const pushX = (minSepX - dx) * 0.55 + 6;
                a.x = Math.max(halfCardW + 4, a.x - pushX);
                b.x = Math.min(window.innerWidth - halfCardW - 4, b.x + pushX);
                if (Math.abs(b.x - a.x) < minSepX * 0.85) {
                  const midY = (a.y + b.y) * 0.5;
                  a.y = Math.max(minY, midY - minSepY * 0.52);
                  b.y = Math.min(maxY, midY + minSepY * 0.52);
                }
              }
            }
          }
        }

        items.forEach(({ cardEl, x, y }) => {
          cardEl.style.left = `${Math.round(x)}px`;
          cardEl.style.top = `${Math.round(y)}px`;
          cardEl.style.display = 'block';
        });
      }
      requestAnimationFrame(updatePositions);
    };
    requestAnimationFrame(updatePositions);
  }

  _updateTopHud() {
    if (!this.runState) return;
    const rs = this.runState;

    const areaLabelEl = this.el.hudAreaBadge.querySelector('.area-label');
    if (areaLabelEl) areaLabelEl.textContent = `AREA ${rs.currentArea}`;
    this.el.hudNodeName.textContent = `${(rs.currentStep || 0) + 1}/5`;

    const hpPct = Math.max(0, Math.min(100, Math.round((rs.hp / rs.maxHp) * 100)));
    this.el.hudHpFill.style.width = `${hpPct}%`;
    this.el.hudHpText.textContent = `${rs.hp}/${rs.maxHp}`;
    this.el.hudGuardText.textContent = rs.guard;
    this.el.hudGoldText.textContent = `${rs.gold}G`;
    this.el.hudRedpenCount.textContent = rs.redPens;
    this.el.hudDeckCount.textContent = rs.deck.length;
    this.el.hudRulesCount.textContent = `${rs.equippedRules.length}/${rs.maxEquippedRules}`;

    // Render equipped foul rules bar
    this.el.hudFoulRules.innerHTML = '';
    rs.equippedRules.forEach((ruleId) => {
      const rule = FOUL_RULES[ruleId];
      if (!rule) return;
      const chip = document.createElement('div');
      chip.className = 'foul-rule-chip';
      chip.dataset.ruleId = rule.id;
      chip.title = `${rule.name}: ${rule.description}`;
      chip.innerHTML = `<span>${rule.icon || '⚠️'}</span><span>${rule.name}</span>`;
      chip.addEventListener('click', () => this.openFoulRulesModal());
      this.el.hudFoulRules.appendChild(chip);
    });
  }

  _renderCombatCardsAndSlots() {
    if (!this.combat || !this.runState) return;

    const rs = this.runState;

    // Show/hide 3rd mod slot if unlocked
    if (rs.maxModSlots >= 3) {
      this.el.slotGroupMod2.classList.remove('hidden');
    } else {
      this.el.slotGroupMod2.classList.add('hidden');
    }

    // Bare punch indicator
    if (!this.slottedActionCard) {
      this.el.btnUseBarePunch.classList.add('active');
      this.el.slotAction.classList.remove('filled');
      this.el.slotAction.innerHTML = `
        <div class="slot-placeholder">
          <span class="placeholder-icon">👊</span>
          <span class="placeholder-text">素手パンチ(4)</span>
        </div>
      `;
    } else {
      this.el.btnUseBarePunch.classList.remove('active');
      this.el.slotAction.classList.add('filled');
      this.el.slotAction.innerHTML = '';
      this.el.slotAction.appendChild(this._createCardElement(this.slottedActionCard, { inSlot: true }));
    }

    // Mod slots
    const modSlotEls = [this.el.slotMod0, this.el.slotMod1, this.el.slotMod2];
    modSlotEls.forEach((slotEl, idx) => {
      const modCard = this.slottedModCards[idx];
      if (!modCard) {
        slotEl.classList.remove('filled');
        slotEl.innerHTML = `
          <div class="slot-placeholder">
            <span class="placeholder-icon">${idx === 0 ? '⚡' : '💥'}</span>
            <span class="placeholder-text">青カード</span>
          </div>
        `;
      } else {
        slotEl.classList.add('filled');
        slotEl.innerHTML = '';
        slotEl.appendChild(this._createCardElement(modCard, { inSlot: true }));
      }
    });

    // Render Hand Cards
    const slottedUids = new Set([
      this.slottedActionCard?.uid,
      ...this.slottedModCards.filter(Boolean).map((c) => c.uid),
    ]);

    this.el.handContainer.innerHTML = '';
    rs.hand.forEach((card) => {
      const isSlotted = slottedUids.has(card.uid);
      const cardEl = this._createCardElement(card, { isSlotted });

      cardEl.addEventListener('click', () => {
        if (this.isAnimating || isSlotted) return;
        this._handleHandCardClick(card);
      });

      this.el.handContainer.appendChild(cardEl);
    });

    this.el.hudDrawCount.textContent = rs.drawPile.length;
    this.el.hudDiscardCount.textContent = rs.discardPile.length;

    this._updateComboPreview();
    this._updateTutorialGuide();
  }

  _handleHandCardClick(card) {
    if (card.type === 'action') {
      this.slottedActionCard = card;
      sound.playCardSelect();
    } else if (card.type === 'mod') {
      const maxSlots = this.runState.maxModSlots || 2;
      let targetIdx = -1;
      for (let i = 0; i < maxSlots; i++) {
        if (!this.slottedModCards[i]) {
          targetIdx = i;
          break;
        }
      }
      if (targetIdx === -1) {
        // Shift and replace last slot
        targetIdx = maxSlots - 1;
      }
      this.slottedModCards[targetIdx] = card;
      sound.playModAttach(targetIdx);
    }

    this._renderCombatCardsAndSlots();
  }

  /**
   * Generates an instant-read short summary tag for any card so the player doesn't have to read paragraphs!
   */
  _getShortCardSummary(card) {
    const id = card.templateId || card.id;
    const isAll = card.target === 'all' || card.overrideTarget === 'all';
    const tgt = isAll ? '全員' : '単体';

    if (card.type === 'action') {
      const dmg = card.baseDamage || 0;
      const hits = card.hits || 1;
      if (id === 'guard_stance') return `🛡️+${card.guardGain || 12} & 盾撃`;
      if (id === 'shield_slam') return `🛡️+${card.guardGain || 6} & 盾100%攻撃`;
      if (id === 'counter_stance') return `🛡️+${card.guardGain || 8} & 倍返し`;
      let base = hits > 1 ? `${tgt} ${dmg}×${hits}回` : `${tgt} ${dmg} DMG`;
      if (card.explosionOnHit > 0) base += ` + 💥爆発${card.explosionOnHit}`;
      else if (card.explosionOnKill > 0) base += ` + 💀撃破爆発${card.explosionOnKill}`;
      else if (card.splashDamage > 0) base += ` + 衝撃波${card.splashDamage}`;
      return base;
    }

    // Mod cards
    const modShortMap = {
      triple_hit: `回数 +${card.hitsAdd || 2}回`,
      heavy_swing: `威力 ×${card.damageMultiplier || 2.5}倍`,
      share_all: '対象 → 敵全員化',
      induce_explosion: `命中ごと 💥爆発${card.explosionOnHitAdd || 3}`,
      encore: '撃破で 再発動！',
      insurance: `命中ごと 🛡️+${card.guardOnHit || 4}`,
      payback: '被ダメ分 威力UP',
      low_hp_bonus: '瀕死で 威力3倍',
      vampire: '命中で HP吸収',
      armor_crush: `軽減貫通 & 💔+${card.vulnOnHit || 3}`,
      double_cast: 'コンボ 2回連続発動',
      guard_convert: '🛡️値を 攻撃力に加算',
    };
    return modShortMap[id] || card.description;
  }

  _createCardElement(card, { inSlot = false, isSlotted = false } = {}) {
    const div = document.createElement('div');
    const isAction = card.type === 'action';
    div.className = `game-card ${isAction ? 'action-card' : 'mod-card'} ${
      inSlot ? 'in-slot' : ''
    } ${isSlotted ? 'selected-in-hand' : ''}`;
    div.title = `${card.name}: ${card.description}`;

    const marks = card.redPenMarks || [];
    const latestMark = marks.length > 0 ? marks[marks.length - 1] : null;
    const shortSummary = this._getShortCardSummary(card);

    let descContentHtml = '';
    if (latestMark) {
      descContentHtml = `
        <div class="redpen-handwriting">🖍️ ${latestMark.newText || shortSummary}</div>
      `;
    } else {
      descContentHtml = `<div>${shortSummary}</div>`;
    }

    div.innerHTML = `
      ${
        latestMark
          ? `<div class="card-redpen-stamp">${latestMark.stamp || '赤ペン!'}</div>`
          : ''
      }
      <div class="card-top-row">
        <span class="card-type-badge">${isAction ? '行動' : '改変'}</span>
        <span class="card-icon">${card.icon || (isAction ? '👊' : '⚡')}</span>
      </div>
      <div class="card-title">${card.name}</div>
      <div class="card-desc">
        ${descContentHtml}
      </div>
    `;

    return div;
  }

  _updateComboPreview() {
    if (!this.combat) return;

    const activeMods = this.slottedModCards.slice(0, this.runState.maxModSlots).filter(Boolean);
    const preview = this.combat.previewCombo(
      this.slottedActionCard,
      activeMods,
      this.selectedTargetId
    );

    const aliveCount = this.combat.getAliveEnemies().length;
    const isAll = preview.targetMode === 'all';
    this.el.previewTargetBadge.textContent = isAll ? `敵全員(${aliveCount}体)` : '敵1体';

    let formulaHtml = `${preview.estimatedDamagePerHit} DMG × ${preview.estimatedHits}回`;
    if (isAll && aliveCount > 1) {
      formulaHtml += ` × ${aliveCount}体`;
    }
    formulaHtml += ` = <strong class="preview-total">${preview.estimatedTotalDirectDamage}</strong>`;

    if (preview.explosionDamagePerHit > 0) {
      formulaHtml += ` <span style="color:#ff6b6b">+ 💥${preview.explosionDamagePerHit}</span>`;
    }
    if (preview.projectedGuardGain > 0) {
      formulaHtml += ` <span style="color:#00e5ff">+ 🛡️${preview.projectedGuardGain}</span>`;
    }

    this.el.previewFormulaText.innerHTML = formulaHtml;

    this.el.previewSynergiesList.innerHTML = '';
    preview.activeSynergies.slice(0, 2).forEach((syn) => {
      const pill = document.createElement('span');
      pill.className = 'synergy-pill';
      // Keep synergy pill short
      const shortSyn = syn.split('→')[0].trim();
      pill.textContent = `🔥 ${shortSyn}`;
      this.el.previewSynergiesList.appendChild(pill);
    });
  }

  // ==========================================================================
  // TIMELINE PLAYBACK: MAXIMUM JUICE COMBO EXECUTION
  // ==========================================================================

  async _handleFireCombo() {
    if (this.isAnimating || !this.combat) return;
    this.isAnimating = true;
    this.skipRequested = false;
    this.el.btnFireCombo.disabled = true;
    this.el.tutorialBanner.classList.add('hidden');
    this._clearTutorialHighlights();

    const activeMods = this.slottedModCards.slice(0, this.runState.maxModSlots).filter(Boolean);
    const chosenAction = this.slottedActionCard;

    // Clear slots visually and retract bottom UI so the 3D arena takes center stage!
    this.slottedActionCard = null;
    this.slottedModCards = [null, null, null];
    this._renderCombatCardsAndSlots();
    this.el.combatUi.classList.add('firing-active');

    sound.playLaunch();
    sound.setBGMMode('combat_chain');

    const events = this.combat.executePlayerFire(
      chosenAction,
      activeMods,
      this.selectedTargetId
    );

    this.el.comboBanner.classList.remove('hidden', 'tier-high', 'tier-fever');
    this.el.comboCountNum.textContent = '0';
    this.el.comboTotalDmg.textContent = '0';
    this.el.comboRuleToast.textContent = '';

    let runningDmg = 0;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const comboNow = ev.comboCount || 1;

      // Dynamic acceleration: the longer the chain, the faster the tempo!
      const baseDelay =
        this.speedMode === 3 || this.skipRequested
          ? 12
          : this.speedMode === 2
          ? Math.max(38, 130 - comboNow * 3)
          : Math.max(55, 220 - comboNow * 4.5);

      await this._playSingleTimelineEvent(ev, runningDmg, (addedDmg) => {
        runningDmg += addedDmg;
      });

      if (ev.type !== 'COMBO_END') {
        await this._sleep(baseDelay);
      }
    }

    await this._sleep(this.skipRequested ? 120 : 450);
    this.el.comboBanner.classList.add('hidden');
    this.el.combatUi.classList.remove('firing-active');

    this._updateTopHud();
    this._sync3DEnemies();

    // Check if battle ended after player fire
    if (this.combat.isBattleOver) {
      await this._handleBattleEnd();
      this.isAnimating = false;
      this.el.btnFireCombo.disabled = false;
      return;
    }

    // Execute Surviving Enemies' Turn
    const enemyEvents = this.combat.executeEnemyTurn();
    for (const eEv of enemyEvents) {
      await this._playEnemyTimelineEvent(eEv);
      await this._sleep(this.speedMode === 3 ? 60 : 280);
    }

    this._updateTopHud();
    this._sync3DEnemies();

    if (this.combat.isBattleOver) {
      await this._handleBattleEnd();
    } else {
      sound.setBGMMode(this.combat.nodeType === 'boss' ? 'boss' : 'planning');
      this._renderCombatCardsAndSlots();
    }

    this.isAnimating = false;
    this.el.btnFireCombo.disabled = false;
  }

  _bumpComboBanner(comboCount, totalDamage) {
    this.el.comboCountNum.textContent = comboCount;
    this.el.comboTotalDmg.textContent = totalDamage;
    this.el.comboCountNum.classList.remove('pop');
    void this.el.comboCountNum.offsetWidth;
    this.el.comboCountNum.classList.add('pop');
    setTimeout(() => {
      this.el.comboCountNum.classList.remove('pop');
    }, 90);

    if (comboCount >= 12) {
      this.el.comboBanner.classList.add('tier-fever');
      this.el.comboBanner.classList.remove('tier-high');
    } else if (comboCount >= 5) {
      this.el.comboBanner.classList.add('tier-high');
    }
  }

  async _playSingleTimelineEvent(ev, currentTotalDmg, addDmgCallback) {
    const screenPositions = this.arena ? this.arena.getEnemyScreenPositions() : {};

    switch (ev.type) {
      case 'COMBO_START': {
        this.el.comboRuleToast.textContent = ev.title;
        const actId = ev.actionCard?.templateId || 'punch';
        this.arena.triggerPlayerAttackAnim(actId, this.selectedTargetId);
        break;
      }

      case 'GUARD_GAIN': {
        sound.playGuard();
        this.arena.setPlayerGuard(ev.newGuard);
        this._updateTopHud();
        this._spawnPopup(220, window.innerHeight * 0.45, `🛡️ +${ev.amount} (${ev.source})`, 'guard');
        break;
      }

      case 'HEAL': {
        this._updateTopHud();
        this._spawnPopup(220, window.innerHeight * 0.4, `💚 +${ev.amount} HP`, 'heal');
        break;
      }

      case 'ATTACK_HIT': {
        addDmgCallback(ev.damage);
        const totalSoFar = currentTotalDmg + ev.damage;
        this._bumpComboBanner(ev.comboCount, totalSoFar);

        const isHeavy = ev.damage >= 18 || ev.comboCount >= 10;
        sound.playHit(ev.comboCount, isHeavy);
        this.arena.triggerHit(ev.targetId, ev.damage, ev.comboCount, { isHeavy });
        this._triggerScreenFlash(isHeavy ? 'flash-hit' : '');

        const pos = screenPositions[ev.targetId] || {
          x: window.innerWidth * 0.65,
          y: window.innerHeight * 0.38,
        };
        const jitterX = (Math.random() - 0.5) * 70;
        const jitterY = (Math.random() - 0.5) * 45;
        const tier = ev.damage >= 35 ? 'mega' : isHeavy ? 'heavy' : 'normal';
        this._spawnPopup(
          pos.x + jitterX,
          pos.y + jitterY,
          `-${ev.damage}${ev.blockedByArmor > 0 ? ` (🛡️-${ev.blockedByArmor})` : ''}`,
          tier
        );

        this._renderEnemy2DHudCards();
        break;
      }

      case 'EXPLOSION': {
        let sumBlast = 0;
        ev.targets.forEach((t) => {
          sumBlast += t.damage;
        });
        addDmgCallback(sumBlast);
        const totalSoFar = currentTotalDmg + sumBlast;
        this._bumpComboBanner(ev.comboCount, totalSoFar);
        this.el.comboRuleToast.textContent = `💥 ${ev.source} (全体${ev.damagePerEnemy}DMG)!!`;

        sound.playExplosion(ev.comboCount);
        const firstTargetId = ev.targets[0]?.targetId || this.selectedTargetId;
        this.arena.triggerExplosion(firstTargetId, ev.damagePerEnemy, ev.comboCount);
        this._triggerScreenFlash('flash-explosion');

        ev.targets.forEach((t, idx) => {
          const pos = screenPositions[t.targetId] || {
            x: window.innerWidth * (0.58 + idx * 0.08),
            y: window.innerHeight * 0.36,
          };
          this._spawnPopup(
            pos.x + (Math.random() - 0.5) * 55,
            pos.y - 20,
            `💥 -${t.damage}`,
            'explosion'
          );
        });

        this._renderEnemy2DHudCards();
        break;
      }

      case 'RULE_TRIGGER': {
        sound.playRuleTrigger();
        this.el.comboRuleToast.textContent = `⚠️ ${ev.ruleName}: ${ev.description}`;

        const chip = this.el.hudFoulRules.querySelector(`[data-rule-id="${ev.ruleId}"]`);
        if (chip) {
          chip.classList.remove('pulsing');
          void chip.offsetWidth;
          chip.classList.add('pulsing');
        }

        this._spawnPopup(
          window.innerWidth * 0.5,
          140 + (Math.random() - 0.5) * 40,
          `⚠️ 反則発動: ${ev.ruleName}！`,
          'rule'
        );
        break;
      }

      case 'CHAIN_ATTACK': {
        this.el.comboRuleToast.textContent = `⚡ ${ev.reason}`;
        this.arena.triggerPlayerAttackAnim('punch', ev.toTargetId);
        break;
      }

      case 'ENEMY_DEATH': {
        sound.playKill(ev.comboCount);
        this.arena.triggerEnemyKill(ev.targetId, 20);
        this._renderEnemy2DHudCards();
        break;
      }

      case 'ENEMY_COUNTER': {
        sound.playEnemyHitPlayer();
        this.arena.triggerPlayerDamage(ev.damageToPlayer);
        this.arena.setPlayerGuard(ev.playerGuard);
        this._updateTopHud();
        this._spawnPopup(
          240,
          window.innerHeight * 0.42,
          `⚡反撃 -${ev.damageToPlayer} (🛡️${ev.blockedByGuard})`,
          'heavy'
        );
        break;
      }

      case 'JACKPOT': {
        this._triggerScreenFlash('flash-jackpot');
        this._spawnPopup(
          window.innerWidth * 0.5,
          window.innerHeight * 0.3,
          `🎰 ${ev.comboCount} CHAIN JACKPOT!! +15G`,
          'mega'
        );
        break;
      }

      case 'COMBO_END': {
        if (ev.totalCombo >= 8 || ev.totalDamage >= 50) {
          this._spawnPopup(
            window.innerWidth * 0.5,
            window.innerHeight * 0.32,
            `🔥 ${ev.totalCombo} CHAIN / ${ev.totalDamage} TOTAL DMG!!`,
            'mega'
          );
        }
        break;
      }
    }
  }

  async _playEnemyTimelineEvent(ev) {
    switch (ev.type) {
      case 'ENEMY_ATTACK': {
        sound.playEnemyHitPlayer();
        this.arena.triggerPlayerDamage(ev.damageToPlayer);
        this.arena.setPlayerGuard(ev.playerGuard);
        this._updateTopHud();

        const msg =
          ev.damageToPlayer > 0
            ? `💥 ${ev.enemyName}: -${ev.damageToPlayer} HP`
            : `🛡️ ${ev.enemyName}の攻撃を完全ガード！`;
        this._spawnPopup(240, window.innerHeight * 0.45, msg, ev.damageToPlayer > 0 ? 'heavy' : 'guard');
        break;
      }

      case 'ENEMY_BUFF': {
        this._renderEnemy2DHudCards();
        this._spawnPopup(
          window.innerWidth * 0.65,
          window.innerHeight * 0.35,
          `⚠️ ${ev.enemyName}: ${ev.label}`,
          'rule'
        );
        break;
      }

      case 'ENEMY_SUMMON': {
        this._sync3DEnemies();
        this._spawnPopup(
          window.innerWidth * 0.65,
          window.innerHeight * 0.35,
          `👾 ${ev.summonerName}が分身を召喚！`,
          'rule'
        );
        break;
      }

      case 'THORNS_TRIGGER': {
        sound.playExplosion(2);
        this.arena.triggerExplosion(ev.attackerId, ev.directDamage, 2);
        this._spawnPopup(
          window.innerWidth * 0.62,
          window.innerHeight * 0.36,
          `🌵 スパイク反撃 -${ev.directDamage} & 全体-${ev.aoeDamage}!`,
          'explosion'
        );
        this._renderEnemy2DHudCards();
        break;
      }

      case 'ENEMY_DEATH': {
        sound.playKill(2);
        this.arena.triggerEnemyKill(ev.targetId, 10);
        this._renderEnemy2DHudCards();
        break;
      }
    }
  }

  async _handleBattleEnd() {
    if (!this.combat) return;

    if (this.combat.result === 'victory') {
      sound.playVictory();
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 },
      });

      // Check if Final Boss of Area 3 was defeated!
      if (this.combat.nodeType === 'boss' && this.runState.currentArea >= 3) {
        await this._sleep(500);
        this.showGameOverScreen(true);
        return;
      }

      await this._sleep(350);
      this.showBattleRewardScreen(this.combat.nodeType);
    } else {
      sound.playDefeat();
      await this._sleep(400);
      this.showGameOverScreen(false);
    }
  }

  // ==========================================================================
  // POST-BATTLE REWARD SCREEN
  // ==========================================================================

  showBattleRewardScreen(nodeType = 'battle') {
    this.el.combatUi.classList.add('hidden');
    const rewards = this.runState.generateBattleRewards(nodeType);

    // Apply automatic gold, red pen, and rule drop
    this.runState.gold += rewards.goldReward;
    if (rewards.redPenReward > 0) {
      this.runState.redPens += rewards.redPenReward;
    }
    let unlockedRuleObj = null;
    if (rewards.bonusRuleId) {
      this.runState.unlockAndEquipRule(rewards.bonusRuleId);
      unlockedRuleObj = FOUL_RULES[rewards.bonusRuleId];
    }

    this._updateTopHud();

    this.el.rewardTitle.textContent =
      nodeType === 'boss'
        ? '👑 エリアボス撃破！豪華反則報酬を選べ！'
        : '🎉 戦闘勝利！新しいカード＆反則パーツ獲得！';

    this.el.rewardSummaryText.textContent = `今戦闘の最大連鎖: ${this.combat.turnComboCount} CHAIN / 累計最大連鎖: ${this.runState.stats.maxComboInRun} CHAIN`;

    this.el.rewardBonusStrip.innerHTML = '';
    const goldChip = document.createElement('div');
    goldChip.className = 'reward-bonus-chip';
    goldChip.textContent = `🪙 ゴールド +${rewards.goldReward}G 獲得！`;
    this.el.rewardBonusStrip.appendChild(goldChip);

    if (rewards.redPenReward > 0) {
      const penChip = document.createElement('div');
      penChip.className = 'reward-bonus-chip';
      penChip.style.borderColor = '#ff2a4b';
      penChip.style.color = '#fda4af';
      penChip.textContent = `🖍️ 改造アイテム『赤ペン』+${rewards.redPenReward}本 獲得！`;
      this.el.rewardBonusStrip.appendChild(penChip);
    }

    if (unlockedRuleObj) {
      const ruleChip = document.createElement('div');
      ruleChip.className = 'reward-bonus-chip';
      ruleChip.style.borderColor = '#ffb800';
      ruleChip.style.color = '#fde047';
      ruleChip.textContent = `⚠️ 新・反則ルール『${unlockedRuleObj.name}』解放！`;
      this.el.rewardBonusStrip.appendChild(ruleChip);
    }

    if (this.runState.redPens > 0) {
      this.el.btnRewardRedpenNow.classList.remove('hidden');
      this.el.btnRewardRedpenNow.textContent = `🖍️ 今すぐ赤ペンでカードを書き換える (残り${this.runState.redPens}本)`;
    } else {
      this.el.btnRewardRedpenNow.classList.add('hidden');
    }

    this.el.rewardCardsContainer.innerHTML = '';
    rewards.cardChoices.forEach((card) => {
      const cardEl = this._createCardElement(card);
      cardEl.addEventListener('click', () => {
        this.runState.addCardToDeck(card);
        sound.playModAttach(1);
        this._proceedAfterBattleReward();
      });
      this.el.rewardCardsContainer.appendChild(cardEl);
    });

    this.el.rewardScreen.classList.remove('hidden');
  }

  _proceedAfterBattleReward() {
    this.el.rewardScreen.classList.add('hidden');
    if (this.combat && this.combat.nodeType === 'boss') {
      this.runState.advanceToNextArea();
    }
    this.showMapScreen();
  }

  // ==========================================================================
  // RED PEN WORKSHOP MODAL (Permanent Card Rule Rewriting!)
  // ==========================================================================

  openRedPenWorkshop(onCloseCallback = null) {
    this._onCloseRedPenCallback = onCloseCallback;
    this.selectedRedPenCardUid = this.runState.deck[0]?.uid || null;
    this._renderRedPenWorkshop();
    this.el.redpenModal.classList.remove('hidden');

    const closeBtn = this.el.btnCloseRedpen;
    closeBtn.onclick = () => {
      this.el.redpenModal.classList.add('hidden');
      this._updateTopHud();
      if (this.combat && !this.combat.isBattleOver) {
        this._renderCombatCardsAndSlots();
      }
      if (typeof this._onCloseRedPenCallback === 'function') {
        const cb = this._onCloseRedPenCallback;
        this._onCloseRedPenCallback = null;
        cb();
      }
    };
  }

  _renderRedPenWorkshop() {
    if (!this.runState) return;
    this.el.redpenModalStock.textContent = this.runState.redPens;

    this.el.redpenDeckGrid.innerHTML = '';
    const allCards = [this.runState.barePunchCard, ...this.runState.deck];

    allCards.forEach((card) => {
      const cardEl = this._createCardElement(card);
      if (card.uid === this.selectedRedPenCardUid) {
        cardEl.style.outline = '4px solid #ff2a4b';
        cardEl.style.transform = 'translateY(-6px)';
      }

      cardEl.addEventListener('click', () => {
        this.selectedRedPenCardUid = card.uid;
        sound.playCardSelect();
        this._renderRedPenWorkshop();
      });

      this.el.redpenDeckGrid.appendChild(cardEl);
    });

    // Render 3 Red Pen rewrite options for the selected card
    this.el.redpenOptionsContainer.innerHTML = '';
    const selectedCard = allCards.find((c) => c.uid === this.selectedRedPenCardUid);
    if (!selectedCard) {
      this.el.redpenOptionsContainer.innerHTML =
        '<div class="empty-hint">左のリストからカードを選択してください</div>';
      return;
    }

    const upgrades = getRedPenUpgrades(selectedCard);
    upgrades.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'redpen-option-btn';
      const canAfford = this.runState.redPens > 0 && !opt.alreadyApplied;
      btn.disabled = !canAfford;

      btn.innerHTML = `
        <div class="redpen-opt-label">
          🖍️ ${opt.label}
          ${opt.alreadyApplied ? '<span style="color:#22c55e;margin-left:8px;">[書き換え済]</span>' : ''}
        </div>
        <div class="redpen-opt-detail">
          <span class="redpen-strike">${opt.oldText}</span>
          <span> ➔ </span>
          <strong style="color:#fde047">${opt.newText}</strong>
        </div>
      `;

      btn.addEventListener('click', () => {
        if (!canAfford) return;
        this.runState.rewriteCardWithRedPen(selectedCard.uid, opt.id, true);
        // Also sync if this card is currently in combat hand
        if (this.combat) {
          const inHand = this.runState.hand.find((c) => c.uid === selectedCard.uid);
          if (inHand && inHand !== selectedCard) {
            Object.assign(inHand, structuredClone(selectedCard));
          }
        }
        sound.playRedPenWrite();
        if (this.arena) {
          this.arena.triggerRedPenSlash();
        }
        this._updateTopHud();
        this._renderRedPenWorkshop();
      });

      this.el.redpenOptionsContainer.appendChild(btn);
    });
  }

  // ==========================================================================
  // FOUL RULES MANAGER, DECK VIEWER, SHOP & MYSTERY EVENTS
  // ==========================================================================

  openFoulRulesModal() {
    if (!this.runState) return;
    this.el.utilityModalKicker.textContent = 'FOUL RULES EQUIPMENT // 反則ルール編成';
    this.el.utilityModalTitle.textContent = `戦場に適用する反則ルール (${this.runState.equippedRules.length} / ${this.runState.maxEquippedRules} 枠装備中)`;

    const renderBody = () => {
      this.el.utilityModalTitle.textContent = `戦場に適用する反則ルール (${this.runState.equippedRules.length} / ${this.runState.maxEquippedRules} 枠装備中)`;
      this.el.utilityModalBody.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'rules-grid';

      Object.values(FOUL_RULES).forEach((rule) => {
        const isUnlocked = this.runState.unlockedRules.includes(rule.id);
        const isEquipped = this.runState.equippedRules.includes(rule.id);

        const box = document.createElement('div');
        box.className = `rule-card-box ${isEquipped ? 'equipped' : ''}`;
        box.style.opacity = isUnlocked ? '1' : '0.45';

        box.innerHTML = `
          <div>
            <div style="font-weight:900;font-size:0.98rem;color:${isEquipped ? '#ffb800' : '#fff'}">
              ${rule.icon || '⚠️'} ${rule.name}
            </div>
            <div style="font-size:0.8rem;color:#cbd5e1;margin-top:4px;">${rule.description}</div>
          </div>
          <div>
            ${
              isUnlocked
                ? `<button class="hud-btn" style="width:100%;border-color:${
                    isEquipped ? '#ff2a4b' : '#22c55e'
                  }">${isEquipped ? '✔ 装備中 (クリックで外す)' : '＋ 装備する'}</button>`
                : '<span style="font-size:0.75rem;color:#94a3b8;">🔒 エリート戦・ショップで解放</span>'
            }
          </div>
        `;

        if (isUnlocked) {
          box.querySelector('button').addEventListener('click', () => {
            this.runState.toggleEquipRule(rule.id);
            sound.playCardSelect();
            this._updateTopHud();
            renderBody();
          });
        }

        grid.appendChild(box);
      });

      this.el.utilityModalBody.appendChild(grid);
    };

    renderBody();
    this.el.utilityModal.classList.remove('hidden');
  }

  openDeckViewerModal() {
    if (!this.runState) return;
    this.el.utilityModalKicker.textContent = 'DECK & CARD REMOVAL // デッキ一覧・圧縮';
    this.el.utilityModalTitle.textContent = `所持デッキ一覧 (${this.runState.deck.length}枚)`;

    const renderDeck = () => {
      this.el.utilityModalTitle.textContent = `所持デッキ一覧 (${this.runState.deck.length}枚) - 不要なカードは20Gで削除してコンボ率UP！`;
      this.el.utilityModalBody.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'mini-card-grid';

      this.runState.deck.forEach((card) => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '4px';

        const cardEl = this._createCardElement(card);
        wrapper.appendChild(cardEl);

        if (this.runState.deck.length > 5) {
          const delBtn = document.createElement('button');
          delBtn.className = 'hud-btn';
          delBtn.style.fontSize = '0.7rem';
          delBtn.textContent = '🗑️ 削除 (20G)';
          delBtn.disabled = this.runState.gold < 20;
          delBtn.addEventListener('click', () => {
            if (this.runState.gold >= 20 && this.runState.removeCardFromDeck(card.uid)) {
              this.runState.gold -= 20;
              sound.playCardSelect();
              this._updateTopHud();
              renderDeck();
            }
          });
          wrapper.appendChild(delBtn);
        }

        grid.appendChild(wrapper);
      });

      this.el.utilityModalBody.appendChild(grid);
    };

    renderDeck();
    this.el.utilityModal.classList.remove('hidden');
  }

  openBlackMarketShop(onCloseCallback = null) {
    this.currentShopInventory = this.runState.generateShopInventory();
    this.el.utilityModalKicker.textContent = 'BLACK MARKET // 購買部・裏闇市';

    const renderShop = () => {
      this.el.utilityModalTitle.textContent = `購買部・裏闇市 (所持ゴールド: ${this.runState.gold}G)`;
      this.el.utilityModalBody.innerHTML = '';

      // Services (Red Pen, Slot expansions, Heal)
      const srvTitle = document.createElement('h3');
      srvTitle.className = 'col-subtitle';
      srvTitle.textContent = '▼ 禁断の反則パーツ＆スロット拡張';
      this.el.utilityModalBody.appendChild(srvTitle);

      const srvGrid = document.createElement('div');
      srvGrid.className = 'rules-grid';

      this.currentShopInventory.services.forEach((srv) => {
        const box = document.createElement('div');
        box.className = 'rule-card-box';
        const canBuy = !srv.sold && this.runState.gold >= srv.price;

        box.innerHTML = `
          <div>
            <div style="font-weight:900;color:#fde047">${srv.icon} ${srv.name}</div>
            <div style="font-size:0.78rem;color:#cbd5e1;margin-top:4px;">${srv.description}</div>
          </div>
          <button class="hud-btn" ${!canBuy ? 'disabled' : ''}>
            ${srv.sold ? '✔ 購入済' : `🪙 ${srv.price}G で購入`}
          </button>
        `;

        box.querySelector('button').addEventListener('click', () => {
          if (!canBuy) return;
          this.runState.gold -= srv.price;
          srv.sold = true;
          if (srv.id === 'buy_red_pen') this.runState.redPens += 1;
          if (srv.id === 'expand_rule_slot') this.runState.maxEquippedRules = 3;
          if (srv.id === 'expand_mod_slot') this.runState.maxModSlots = 3;
          if (srv.id === 'shop_heal') this.runState.heal(40);
          sound.playModAttach(1);
          this._updateTopHud();
          renderShop();
        });

        srvGrid.appendChild(box);
      });
      this.el.utilityModalBody.appendChild(srvGrid);

      // Foul rules for sale
      if (this.currentShopInventory.rules.length > 0) {
        const rTitle = document.createElement('h3');
        rTitle.className = 'col-subtitle';
        rTitle.textContent = '▼ 反則ルール入荷';
        this.el.utilityModalBody.appendChild(rTitle);

        const rGrid = document.createElement('div');
        rGrid.className = 'rules-grid';

        this.currentShopInventory.rules.forEach((item) => {
          const box = document.createElement('div');
          box.className = 'rule-card-box';
          const canBuy = !item.sold && this.runState.gold >= item.price;

          box.innerHTML = `
            <div>
              <div style="font-weight:900;color:#ff6b6b">${item.rule.icon || '⚠️'} ${item.rule.name}</div>
              <div style="font-size:0.78rem;color:#cbd5e1;margin-top:4px;">${item.rule.description}</div>
            </div>
            <button class="hud-btn" ${!canBuy ? 'disabled' : ''}>
              ${item.sold ? '✔ 習得済' : `🪙 ${item.price}G で習得＆装備`}
            </button>
          `;

          box.querySelector('button').addEventListener('click', () => {
            if (!canBuy) return;
            this.runState.gold -= item.price;
            item.sold = true;
            this.runState.unlockAndEquipRule(item.rule.id);
            sound.playRuleTrigger();
            this._updateTopHud();
            renderShop();
          });

          rGrid.appendChild(box);
        });
        this.el.utilityModalBody.appendChild(rGrid);
      }

      // Cards for sale
      const cTitle = document.createElement('h3');
      cTitle.className = 'col-subtitle';
      cTitle.textContent = '▼ シングルカード販売';
      this.el.utilityModalBody.appendChild(cTitle);

      const cGrid = document.createElement('div');
      cGrid.className = 'reward-cards-grid';

      this.currentShopInventory.cards.forEach((item) => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '6px';

        wrap.appendChild(this._createCardElement(item.card));
        const btn = document.createElement('button');
        btn.className = 'hud-btn';
        const canBuy = !item.sold && this.runState.gold >= item.price;
        btn.disabled = !canBuy;
        btn.textContent = item.sold ? '✔ 購入済' : `🪙 ${item.price}G で購入`;

        btn.addEventListener('click', () => {
          if (!canBuy) return;
          this.runState.gold -= item.price;
          item.sold = true;
          this.runState.addCardToDeck(item.card);
          sound.playCardSelect();
          this._updateTopHud();
          renderShop();
        });

        wrap.appendChild(btn);
        cGrid.appendChild(wrap);
      });

      this.el.utilityModalBody.appendChild(cGrid);
    };

    renderShop();
    this.el.utilityModal.classList.remove('hidden');

    this.el.btnCloseUtility.onclick = () => {
      this.el.utilityModal.classList.add('hidden');
      this._updateTopHud();
      if (typeof onCloseCallback === 'function') onCloseCallback();
    };
  }

  openMysteryEventModal(onCloseCallback = null) {
    const ev = MYSTERY_EVENTS[Math.floor(Math.random() * MYSTERY_EVENTS.length)];
    this.el.utilityModalKicker.textContent = 'MYSTERY EVENT // ハプニング発生！';
    this.el.utilityModalTitle.textContent = `${ev.icon || '❓'} ${ev.title}`;
    this.el.utilityModalBody.innerHTML = '';

    const desc = document.createElement('p');
    desc.className = 'modal-desc';
    desc.textContent = ev.description;
    this.el.utilityModalBody.appendChild(desc);

    const choicesBox = document.createElement('div');
    choicesBox.className = 'redpen-options-container';

    ev.choices.forEach((ch) => {
      const btn = document.createElement('button');
      btn.className = 'redpen-option-btn';
      btn.innerHTML = `
        <div class="redpen-opt-label">▶ ${ch.label}</div>
        <div class="redpen-opt-detail">${ch.effectText || ''}</div>
      `;

      btn.addEventListener('click', () => {
        if (typeof ch.apply === 'function') {
          ch.apply(this.runState);
        } else {
          // Fallback generic effect handling
          this.runState.redPens += 1;
          this.runState.heal(15);
        }
        sound.playRuleTrigger();
        this._updateTopHud();
        this.el.utilityModal.classList.add('hidden');
        if (typeof onCloseCallback === 'function') onCloseCallback();
      });

      choicesBox.appendChild(btn);
    });

    this.el.utilityModalBody.appendChild(choicesBox);
    this.el.utilityModal.classList.remove('hidden');

    this.el.btnCloseUtility.onclick = () => {
      this.el.utilityModal.classList.add('hidden');
      if (typeof onCloseCallback === 'function') onCloseCallback();
    };
  }

  // ==========================================================================
  // GAME OVER / RUN VICTORY SCREEN
  // ==========================================================================

  showGameOverScreen(isVictory = false) {
    this.el.combatUi.classList.add('hidden');
    this.el.rewardScreen.classList.add('hidden');
    this.el.mapScreen.classList.add('hidden');

    const st = this.runState.stats;
    this.el.gameoverKicker.textContent = isVictory ? 'CHAMPION OF FOUL PLAY!!' : 'KNOCKED OUT...';
    this.el.gameoverTitle.textContent = isVictory
      ? '👑 完全制覇！絶対審判長を反則コンボで粉砕！！'
      : '💀 敗北…次のランではもっとエグい反則コンボを組もう！';

    this.el.gameoverDesc.textContent = isVictory
      ? 'あなたが設計した異常なカード改変と反則ルールの連鎖が、地下アリーナのすべての秩序を吹き飛ばしました！'
      : '赤ペンによるカード書き換えと、反則ルールの相乗効果（誘爆×死体爆弾など）を狙うと一気に火力が爆発します！';

    this.el.gameoverStatsGrid.innerHTML = `
      <div class="stat-summary-box">
        <div class="stat-summary-label">最大連鎖記録 (MAX CHAIN)</div>
        <div class="stat-summary-val">${st.maxComboInRun} CHAIN</div>
      </div>
      <div class="stat-summary-box">
        <div class="stat-summary-label">最大1ターンダメージ</div>
        <div class="stat-summary-val">${st.maxTurnDamageInRun} DMG</div>
      </div>
      <div class="stat-summary-box">
        <div class="stat-summary-label">撃破した敵の総数</div>
        <div class="stat-summary-val">${st.enemiesDefeated} 体</div>
      </div>
      <div class="stat-summary-box">
        <div class="stat-summary-label">赤ペン魔改造回数</div>
        <div class="stat-summary-val">${st.redPensUsed} 回</div>
      </div>
    `;

    this.el.gameoverScreen.classList.remove('hidden');
  }

  // ==========================================================================
  // FX HELPERS (Floating Popups & Screen Flash)
  // ==========================================================================

  _spawnPopup(x, y, text, styleClass = 'normal') {
    const el = document.createElement('div');
    el.className = `dmg-popup ${styleClass}`;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.textContent = text;
    this.el.damagePopupLayer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 920);
  }

  _triggerScreenFlash(flashClass) {
    if (!flashClass) return;
    this.el.fxOverlay.className = `pointer-events-none ${flashClass}`;
    setTimeout(() => {
      this.el.fxOverlay.className = 'pointer-events-none';
    }, 115);
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize app on DOMContentLoaded and expose on window for automated playtesting
window.addEventListener('DOMContentLoaded', () => {
  window.__HANSOKU_APP__ = new HansokuJotoApp();
});
