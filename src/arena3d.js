/**
 * 『反則上等！』 (Hansoku Joto!) — Three.js 3D Underground Rule-Breaking Wrestling Ring & Physics Arena
 * Renders a stylized neon-lit 3D battle stadium, chunky 3D brawler hero, 7 distinct enemy types,
 * interactive raycast enemy targeting, screen-space HUD anchors, ragdoll KO launches, and explosive physics!
 */

import * as THREE from 'three';

export class Arena3D {
  /**
   * @param {HTMLElement} container
   * @param {Object} [callbacks]
   * @param {(enemyId: string) => void} [callbacks.onSelectEnemy]
   */
  constructor(container, callbacks = {}) {
    if (typeof callbacks === 'function') {
      this.onSelectEnemy = callbacks;
    } else {
      this.onSelectEnemy = callbacks.onSelectEnemy || null;
    }

    this.container = container;
    this.width = (container && container.clientWidth) || window.innerWidth || 1280;
    this.height = (container && container.clientHeight) || window.innerHeight || 720;

    // Core Three.js scene, camera, renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0716);
    this.scene.fog = new THREE.FogExp2(0x0b0716, 0.024);

    this.camera = new THREE.PerspectiveCamera(42, this.width / this.height, 0.1, 120);
    this.baseCamPos = new THREE.Vector3(0, 6.8, 16.5);
    this.baseLookAt = new THREE.Vector3(0.4, 0.85, -0.3);
    this._applyResponsiveCameraFraming();
    this.currentLookAt = this.baseLookAt.clone();
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.currentLookAt);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(this.width, this.height);

    // Detect software WebGL renderer (SwiftShader / llvmpipe) to optimize frame rate
    let isSoftwareGl = false;
    try {
      const gl = this.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
      if (/swiftshader|llvmpipe|software/i.test(String(rendererStr))) {
        isSoftwareGl = true;
      }
    } catch {
      // ignore
    }
    this.isSoftwareGl = isSoftwareGl;

    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    if (this.container) {
      this.container.appendChild(this.renderer.domElement);
    }

    // Shared white flash material for 80ms hit flash
    this.flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Time, Hitstop, Slow-Mo, Camera Shake & Combo Zoom state
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;
    this.timeScale = 1.0;
    this.slowMoTimer = 0;
    this.hitstopTimer = 0;

    this.shakeIntensity = 0;
    this.comboZoomTarget = 0;
    this.comboZoomCurrent = 0;
    this.comboZoomDecayTimer = 0;
    this.focusWorldPos = new THREE.Vector3(1.8, 2.2, 0);

    // Actors & Physics collections
    this.player = null;
    this.enemies = new Map(); // enemyId -> EnemyRecord
    this.selectedEnemyId = null;
    this.targetRing = null;

    this.ringProps = []; // Scattered physics props around ring
    this.particles = []; // 3D burst particles, shockwaves, beams, dynamite
    this.ragdolls = []; // Defeated enemies flying through the air
    this.floatingMotes = null;
    this.spotlights = [];

    // Raycaster for clicking/tapping enemies in 3D
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();

    // Build scene elements
    this._setupLights();
    this._buildWrestlingRing();
    this._buildRingProps();
    this._buildFloatingMotes();
    this._buildPlayerCharacter();
    this._buildTargetRing();

    // Bind events
    this._onResizeBound = this.handleResize.bind(this);
    this._onPointerDownBound = this._onPointerDown.bind(this);
    window.addEventListener('resize', this._onResizeBound);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDownBound);

    // Start 60fps animation loop
    this._animFrameId = null;
    this._animateBound = this._animate.bind(this);
    this._animate();
  }

  // ============================================================================
  // Lighting & Underground Stadium Setup
  // ============================================================================

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0x9d7bff, 0x1a0e2e, 1.15);
    this.scene.add(hemi);

    // Main dramatic overhead stadium key light
    const dirLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    dirLight.position.set(4, 16, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 35;
    const d = 10;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Neon rim lights (Magenta left, Cyan right, Red under-glow)
    const leftNeon = new THREE.PointLight(0xff2a85, 4.5, 18);
    leftNeon.position.set(-7.5, 4.5, 2.5);
    this.scene.add(leftNeon);

    const rightNeon = new THREE.PointLight(0x00f0ff, 4.5, 18);
    rightNeon.position.set(7.5, 4.5, 2.5);
    this.scene.add(rightNeon);

    const backRim = new THREE.PointLight(0xffae00, 3.2, 22);
    backRim.position.set(0, 7, -8);
    this.scene.add(backRim);

    // Animated volumetric-style stadium spotlight cones in background
    const coneGeo = new THREE.ConeGeometry(3.2, 16, 16, 1, true);
    const spotConfigs = [
      { color: 0xff2a6d, x: -7, z: -6, rotZ: -0.32 },
      { color: 0x05d5ff, x: 7, z: -6, rotZ: 0.32 },
      { color: 0xffbe0b, x: 0, z: -8, rotZ: 0.0 }
    ];

    spotConfigs.forEach((cfg, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.075,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const cone = new THREE.Mesh(coneGeo, mat);
      cone.position.set(cfg.x, 8.5, cfg.z);
      cone.rotation.z = cfg.rotZ;
      this.scene.add(cone);
      this.spotlights.push({ mesh: cone, baseRotZ: cfg.rotZ, phase: i * 2.1 });
    });
  }

  _buildWrestlingRing() {
    this.ringGroup = new THREE.Group();
    this.scene.add(this.ringGroup);

    // Outer stadium floor
    const stadiumFloorGeo = new THREE.PlaneGeometry(70, 70);
    const stadiumFloorMat = new THREE.MeshStandardMaterial({
      color: 0x090612,
      roughness: 0.85,
      metalness: 0.2
    });
    const stadiumFloor = new THREE.Mesh(stadiumFloorGeo, stadiumFloorMat);
    stadiumFloor.rotation.x = -Math.PI / 2;
    stadiumFloor.position.y = -1.1;
    stadiumFloor.receiveShadow = true;
    this.ringGroup.add(stadiumFloor);

    // Underground arena hazard grid on outer floor
    const gridHelper = new THREE.GridHelper(48, 32, 0xff2a6d, 0x231742);
    gridHelper.position.y = -1.08;
    this.ringGroup.add(gridHelper);

    // Wrestling Ring Base Platform (12.4 x 1.1 x 8.4)
    const ringWidth = 12.4;
    const ringDepth = 8.4;
    const baseGeo = new THREE.BoxGeometry(ringWidth, 1.1, ringDepth);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1b142e,
      roughness: 0.6,
      metalness: 0.4
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.55;
    baseMesh.receiveShadow = true;
    this.ringGroup.add(baseMesh);

    // Ring Mat Surface with bold canvas look
    const matGeo = new THREE.BoxGeometry(ringWidth - 0.3, 0.14, ringDepth - 0.3);
    const matMaterial = new THREE.MeshStandardMaterial({
      color: 0x241d3d,
      roughness: 0.48,
      metalness: 0.15
    });
    const matMesh = new THREE.Mesh(matGeo, matMaterial);
    matMesh.position.y = 0.02;
    matMesh.receiveShadow = true;
    this.ringGroup.add(matMesh);

    // Center "RULE BREAKER / 反則" Neon Ring Emblem (Procedural rings + X cross)
    const centerCircleGeo = new THREE.RingGeometry(1.6, 1.85, 32);
    const centerCircleMat = new THREE.MeshBasicMaterial({
      color: 0xff2a6d,
      side: THREE.DoubleSide
    });
    const centerCircle = new THREE.Mesh(centerCircleGeo, centerCircleMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.1;
    this.ringGroup.add(centerCircle);

    const crossBarGeo = new THREE.PlaneGeometry(2.8, 0.28);
    const crossBarMat = new THREE.MeshBasicMaterial({
      color: 0xffbe0b,
      side: THREE.DoubleSide
    });
    const cross1 = new THREE.Mesh(crossBarGeo, crossBarMat);
    cross1.rotation.x = -Math.PI / 2;
    cross1.rotation.z = Math.PI / 4;
    cross1.position.y = 0.105;
    const cross2 = new THREE.Mesh(crossBarGeo, crossBarMat);
    cross2.rotation.x = -Math.PI / 2;
    cross2.rotation.z = -Math.PI / 4;
    cross2.position.y = 0.105;
    this.ringGroup.add(cross1, cross2);

    // Glowing Apron Neon Borders
    const apronMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const apronFrontGeo = new THREE.BoxGeometry(ringWidth + 0.08, 0.12, 0.12);
    const apronFront = new THREE.Mesh(apronFrontGeo, apronMat);
    apronFront.position.set(0, 0.06, ringDepth / 2);
    const apronBack = apronFront.clone();
    apronBack.position.set(0, 0.06, -ringDepth / 2);

    const apronSideGeo = new THREE.BoxGeometry(0.12, 0.12, ringDepth + 0.08);
    const apronLeft = new THREE.Mesh(apronSideGeo, apronMat);
    apronLeft.position.set(-ringWidth / 2, 0.06, 0);
    const apronRight = apronLeft.clone();
    apronRight.position.set(ringWidth / 2, 0.06, 0);
    this.ringGroup.add(apronFront, apronBack, apronLeft, apronRight);

    // 4 Corner Posts & Turnbuckles
    const postGeo = new THREE.CylinderGeometry(0.24, 0.28, 2.7, 12);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x2c2547,
      metalness: 0.75,
      roughness: 0.25
    });
    const capGeo = new THREE.SphereGeometry(0.32, 12, 12);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xff2a6d,
      emissive: 0xff1155,
      emissiveIntensity: 0.7
    });

    const halfW = ringWidth / 2 - 0.35;
    const halfD = ringDepth / 2 - 0.35;
    const corners = [
      [-halfW, -halfD],
      [halfW, -halfD],
      [halfW, halfD],
      [-halfW, halfD]
    ];

    corners.forEach(([cx, cz]) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(cx, 1.35, cz);
      post.castShadow = true;
      this.ringGroup.add(post);

      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(cx, 2.75, cz);
      this.ringGroup.add(cap);
    });

    // Neon Ring Ropes (Back, Left, Right full 3 tiers; Front low apron cable so camera view is unobstructed)
    const ropeHeights = [0.75, 1.45, 2.15];
    const ropeColors = [0x00f0ff, 0xffbe0b, 0xff2a6d];

    ropeHeights.forEach((ry, tierIdx) => {
      const rMat = new THREE.MeshStandardMaterial({
        color: ropeColors[tierIdx],
        emissive: ropeColors[tierIdx],
        emissiveIntensity: 0.55,
        roughness: 0.3
      });

      // Back rope
      const backRopeGeo = new THREE.CylinderGeometry(0.055, 0.055, halfW * 2, 8);
      const backRope = new THREE.Mesh(backRopeGeo, rMat);
      backRope.rotation.z = Math.PI / 2;
      backRope.position.set(0, ry, -halfD);
      this.ringGroup.add(backRope);

      // Left & Right ropes
      const sideRopeGeo = new THREE.CylinderGeometry(0.055, 0.055, halfD * 2, 8);
      const leftRope = new THREE.Mesh(sideRopeGeo, rMat);
      leftRope.rotation.x = Math.PI / 2;
      leftRope.position.set(-halfW, ry, 0);

      const rightRope = new THREE.Mesh(sideRopeGeo, rMat);
      rightRope.rotation.x = Math.PI / 2;
      rightRope.position.set(halfW, ry, 0);

      this.ringGroup.add(leftRope, rightRope);
    });
  }

  /**
   * Build scattered 3D physics props (torn rulebooks, red marker pens, golden whistles, dumbbells, folding chairs)
   * around the ring apron & floor that bounce and scatter when explosions or heavy hits happen!
   */
  _buildRingProps() {
    const propLocations = [
      { type: 'rulebook', x: -4.8, y: 0.18, z: 3.3 },
      { type: 'rulebook', x: 4.5, y: 0.18, z: -3.2 },
      { type: 'rulebook', x: -1.8, y: 0.18, z: -3.4 },
      { type: 'red_pen', x: -3.2, y: 0.18, z: 3.5 },
      { type: 'red_pen', x: 2.9, y: 0.18, z: 3.4 },
      { type: 'whistle', x: 0.6, y: 0.22, z: 3.5 },
      { type: 'whistle', x: 4.9, y: 0.22, z: 3.1 },
      { type: 'dumbbell', x: -5.2, y: 0.25, z: -2.9 },
      { type: 'dumbbell', x: 3.6, y: 0.25, z: -3.3 },
      { type: 'chair', x: -6.8, y: -0.9, z: 2.8 },
      { type: 'chair', x: 6.9, y: -0.9, z: 2.5 },
      { type: 'chair', x: 5.5, y: 0.15, z: -2.8 }
    ];

    propLocations.forEach((cfg) => {
      const mesh = this._createPropMesh(cfg.type);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.rotation.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.3
      );
      this.scene.add(mesh);

      this.ringProps.push({
        mesh,
        homeY: cfg.y,
        velocity: new THREE.Vector3(),
        angularVel: new THREE.Vector3(),
        isAirborne: false
      });
    });
  }

  _createPropMesh(type) {
    const group = new THREE.Group();

    if (type === 'rulebook') {
      // Torn Rulebook with red X cover
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.14, 0.82),
        new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.7 })
      );
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.1, 0.78),
        new THREE.MeshStandardMaterial({ color: 0xfef9e7 })
      );
      pages.position.x = 0.03;
      const redSlash = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.15, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xff1e42 })
      );
      redSlash.rotation.y = 0.6;
      group.add(cover, pages, redSlash);
    } else if (type === 'red_pen') {
      // Chunky Red Marker Pen
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.75, 10),
        new THREE.MeshStandardMaterial({ color: 0xe6193c, roughness: 0.3 })
      );
      body.rotation.z = Math.PI / 2;
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.075, 0.2, 10),
        new THREE.MeshBasicMaterial({ color: 0xff2a55 })
      );
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = 0.45;
      group.add(body, tip);
    } else if (type === 'whistle') {
      // Golden Referee Whistle
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        metalness: 0.8,
        roughness: 0.2
      });
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 12), goldMat);
      drum.rotation.x = Math.PI / 2;
      const mouthpiece = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.16), goldMat);
      mouthpiece.position.x = 0.2;
      group.add(drum, mouthpiece);
    } else if (type === 'dumbbell') {
      // Heavy Iron Dumbbell
      const ironMat = new THREE.MeshStandardMaterial({
        color: 0x3b4254,
        metalness: 0.75,
        roughness: 0.3
      });
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), ironMat);
      bar.rotation.z = Math.PI / 2;
      const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 10), ironMat);
      w1.rotation.z = Math.PI / 2;
      w1.position.x = -0.26;
      const w2 = w1.clone();
      w2.position.x = 0.26;
      group.add(bar, w1, w2);
    } else {
      // Folding Wrestling Chair
      const chairMat = new THREE.MeshStandardMaterial({
        color: 0xd9a400,
        metalness: 0.6,
        roughness: 0.35
      });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 0.75), chairMat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.72), chairMat);
      back.position.set(0, 0.08, -0.1);
      back.rotation.x = 0.12;
      group.add(seat, back);
    }

    return group;
  }

  _buildFloatingMotes() {
    const count = 90;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0xff2a6d),
      new THREE.Color(0x00f0ff),
      new THREE.Color(0xffbe0b)
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = Math.random() * 8 + 0.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;

      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.floatingMotes = new THREE.Points(geo, mat);
    this.scene.add(this.floatingMotes);
  }

  // ============================================================================
  // Stylized 3D Player Character (Left Side of Ring)
  // ============================================================================

  _buildPlayerCharacter() {
    const root = new THREE.Group();
    const homePos = new THREE.Vector3(-3.8, 0.1, 0.4);
    root.position.copy(homePos);
    root.rotation.y = Math.PI * 0.44; // Face right toward enemies
    this.scene.add(root);

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // Legs / Boots
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a1829, roughness: 0.4 });
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.7, 0.44), bootMat);
    leftLeg.position.set(-0.28, 0.35, 0);
    leftLeg.castShadow = true;
    const rightLeg = leftLeg.clone();
    rightLeg.position.set(0.28, 0.35, 0);
    bodyGroup.add(leftLeg, rightLeg);

    // Torso (Delinquent crimson battle jacket + gold belt)
    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0xd91e41,
      roughness: 0.35,
      metalness: 0.15
    });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 0.68), jacketMat);
    torso.position.y = 1.22;
    torso.castShadow = true;
    bodyGroup.add(torso);

    const beltMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.8,
      roughness: 0.2
    });
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.72), beltMat);
    belt.position.y = 0.74;
    bodyGroup.add(belt);

    // Head + Glowing Rebellious Headband + Spiky Pompadour Hair
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcfa3, roughness: 0.45 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.74, 0.74), skinMat);
    head.position.y = 2.2;
    head.castShadow = true;
    bodyGroup.add(head);

    // Glowing Headband + Flowing Tails
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xff0044,
      emissive: 0xff0044,
      emissiveIntensity: 0.85
    });
    const headband = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.8), bandMat);
    headband.position.y = 2.34;
    bodyGroup.add(headband);

    const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), bandMat);
    tail1.position.set(-0.22, 2.18, -0.52);
    tail1.rotation.x = 0.55;
    tail1.rotation.z = -0.25;
    const tail2 = tail1.clone();
    tail2.position.set(0.16, 2.24, -0.52);
    tail2.rotation.z = 0.25;
    bodyGroup.add(tail1, tail2);

    // Fierce Glowing Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.05), eyeMat);
    leftEye.position.set(-0.18, 2.22, 0.38);
    const rightEye = leftEye.clone();
    rightEye.position.set(0.18, 2.22, 0.38);
    bodyGroup.add(leftEye, rightEye);

    // Spiky Hair Crown
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x161224, roughness: 0.5 });
    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.58, 6), hairMat);
    hair.position.set(0, 2.75, 0.08);
    hair.rotation.x = 0.25;
    bodyGroup.add(hair);

    // Oversized Brawler Gauntlets (Left & Right Fists)
    const gauntletMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff5500,
      emissiveIntensity: 0.35,
      metalness: 0.55,
      roughness: 0.25
    });
    const leftFist = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.72), gauntletMat);
    leftFist.position.set(-0.85, 1.32, 0.38);
    leftFist.castShadow = true;

    const rightFist = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.78), gauntletMat);
    rightFist.position.set(0.85, 1.32, 0.45);
    rightFist.castShadow = true;
    bodyGroup.add(leftFist, rightFist);

    // Guard Shield Dome Visual (Visible when Guard > 0)
    const shieldGeo = new THREE.SphereGeometry(1.85, 20, 16);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00aaff,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.26,
      wireframe: false
    });
    const shieldDome = new THREE.Mesh(shieldGeo, shieldMat);
    shieldDome.position.y = 1.45;
    shieldDome.visible = false;

    const shieldWire = new THREE.Mesh(
      new THREE.SphereGeometry(1.88, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0x66ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.45
      })
    );
    shieldDome.add(shieldWire);
    root.add(shieldDome);

    this.player = {
      root,
      bodyGroup,
      leftFist,
      rightFist,
      tail1,
      tail2,
      shieldDome,
      homePos,
      guardAmount: 0,
      attackAnim: null, // { type, timer, duration, targetPos }
      recoilTimer: 0
    };
  }

  _buildTargetRing() {
    const group = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.95, 1.18, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff2a6d,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    group.add(ringMesh);

    // 4 Corner bracket arrows around target reticle
    const arrowGeo = new THREE.ConeGeometry(0.18, 0.38, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.set(Math.cos(angle) * 1.35, 0.08, Math.sin(angle) * 1.35);
      arrow.rotation.x = Math.PI / 2;
      arrow.rotation.z = -angle - Math.PI / 2;
      group.add(arrow);
    }

    group.position.y = 0.12;
    group.visible = false;
    this.scene.add(group);
    this.targetRing = group;
  }

  // ============================================================================
  // State Synchronization & Enemy Mesh Factory (7 Distinct Enemy Types)
  // ============================================================================

  /**
   * Synchronize or update player guard shield state
   */
  setPlayerGuard(guardValue = 0) {
    if (!this.player) return;
    this.player.guardAmount = guardValue;
    this.player.shieldDome.visible = guardValue > 0;
  }

  /**
   * Synchronize 3D enemies on the right side of the ring (supports 1 to 4 simultaneous enemies).
   * Accepts an array of enemy objects: `[{ id, name, hp, maxHp, modelType, ... }]`
   */
  syncEnemies(enemyList = [], selectedEnemyId = null) {
    return this.setEnemies(enemyList, selectedEnemyId);
  }

  setEnemies(enemyList = [], selectedEnemyId = null) {
    const incomingIds = new Set();
    const aliveEnemies = enemyList.filter((e) => e && (e.hp === undefined || e.hp > 0));

    // Compute balanced slot positions on the right side of the ring (1 to 4 enemies)
    const count = aliveEnemies.length;
    const slotPositions = this._computeEnemySlots(count);

    aliveEnemies.forEach((data, idx) => {
      const id = String(data.id ?? `enemy_${idx}`);
      incomingIds.add(id);
      const slotPos = slotPositions[idx] || new THREE.Vector3(3.2, 0.1, 0);

      if (!this.enemies.has(id)) {
        const modelKey = data.modelType || data.type || data.templateId || data.id || 'sandbag_jr';
        const record = this._createEnemyRecord(id, modelKey, data, slotPos);
        this.enemies.set(id, record);
      } else {
        const rec = this.enemies.get(id);
        rec.data = { ...rec.data, ...data };
        rec.homePos.copy(slotPos);
      }
    });

    // Remove stale enemy meshes that are no longer in the list
    for (const [id, rec] of this.enemies.entries()) {
      if (!incomingIds.has(id)) {
        this.scene.remove(rec.root);
        this.enemies.delete(id);
      }
    }

    if (selectedEnemyId && this.enemies.has(String(selectedEnemyId))) {
      this.setSelectedEnemy(String(selectedEnemyId));
    } else if (!this.selectedEnemyId || !this.enemies.has(this.selectedEnemyId)) {
      const firstId = aliveEnemies[0] ? String(aliveEnemies[0].id) : null;
      this.setSelectedEnemy(firstId);
    }
  }

  _computeEnemySlots(count) {
    if (count <= 1) {
      return [new THREE.Vector3(3.3, 0.1, 0.2)];
    }
    if (count === 2) {
      return [
        new THREE.Vector3(2.8, 0.1, -1.35),
        new THREE.Vector3(3.7, 0.1, 1.45)
      ];
    }
    if (count === 3) {
      return [
        new THREE.Vector3(2.5, 0.1, -2.0),
        new THREE.Vector3(3.8, 0.1, 0.0),
        new THREE.Vector3(2.8, 0.1, 2.0)
      ];
    }
    return [
      new THREE.Vector3(2.2, 0.1, -2.35),
      new THREE.Vector3(3.9, 0.1, -0.85),
      new THREE.Vector3(2.5, 0.1, 0.95),
      new THREE.Vector3(4.1, 0.1, 2.35)
    ];
  }

  setSelectedEnemy(enemyId) {
    this.selectedEnemyId = enemyId ? String(enemyId) : null;
    if (this.targetRing) {
      this.targetRing.visible = Boolean(
        this.selectedEnemyId && this.enemies.has(this.selectedEnemyId)
      );
    }
  }

  _normalizeModelType(rawKey = '') {
    const key = String(rawKey).toLowerCase();
    if (key.includes('chief') || key.includes('boss')) return 'chief_referee';
    if (key.includes('giant_sandbag') || key.includes('giant')) return 'giant_sandbag';
    if (key.includes('sandbag')) return 'sandbag_jr';
    if (key.includes('hard_referee') || key.includes('referee')) return 'hard_referee';
    if (key.includes('counter') || key.includes('punk')) return 'counter_punk';
    if (key.includes('bomber') || key.includes('bomb')) return 'bomber_man';
    if (key.includes('slime') || key.includes('encore')) return 'encore_slime';
    if (key.includes('whistle') || key.includes('enforcer')) return 'whistle_enforcer';
    return 'sandbag_jr';
  }

  _createEnemyRecord(id, rawModelKey, data, slotPos) {
    const modelType = this._normalizeModelType(rawModelKey);
    const root = new THREE.Group();
    root.position.copy(slotPos);
    root.rotation.y = -Math.PI * 0.45; // Face left toward player
    root.userData.enemyId = id;

    const animGroup = new THREE.Group();
    root.add(animGroup);

    const parts = this._buildEnemyMeshByType(modelType, animGroup);

    // Tag all child meshes for raycasting & store original materials for 80ms white flash
    const meshes = [];
    animGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.enemyId = id;
        child.userData.origMaterial = child.material;
        meshes.push(child);
      }
    });

    this.scene.add(root);

    return {
      id,
      modelType,
      data: { ...data },
      root,
      animGroup,
      parts,
      meshes,
      homePos: slotPos.clone(),
      knockbackOffset: new THREE.Vector3(),
      knockbackVel: new THREE.Vector3(),
      squashScale: new THREE.Vector3(1, 1, 1),
      swingAngle: 0,
      swingVel: 0,
      flashTimer: 0,
      phaseOffset: Math.random() * Math.PI * 2,
      hudHeight: parts.hudHeight || 3.1
    };
  }

  _buildEnemyMeshByType(modelType, container) {
    const parts = { hudHeight: 3.0 };

    if (modelType === 'sandbag_jr' || modelType === 'giant_sandbag') {
      const isGiant = modelType === 'giant_sandbag';
      const scale = isGiant ? 1.38 : 1.0;
      parts.hudHeight = isGiant ? 3.8 : 2.95;

      // Overhead heavy steel stand & chain
      const standMat = new THREE.MeshStandardMaterial({
        color: 0x3b354d,
        metalness: 0.8,
        roughness: 0.25
      });
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11 * scale, 0.14 * scale, 3.2 * scale, 10),
        standMat
      );
      post.position.set(0, 1.6 * scale, -0.65 * scale);
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.16 * scale, 0.16 * scale, 0.85 * scale),
        standMat
      );
      arm.position.set(0, 3.12 * scale, -0.25 * scale);
      container.add(post, arm);

      // Swinging pivot at top of chain
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(0, 3.05 * scale, 0);
      container.add(pivotGroup);
      parts.swingPivot = pivotGroup;

      // Chain links
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.65 * scale, 8),
        new THREE.MeshStandardMaterial({ color: 0xb0b7c6, metalness: 0.9, roughness: 0.2 })
      );
      chain.position.y = -0.32 * scale;
      pivotGroup.add(chain);

      // Stitched Leather Punching Bag
      const bagMat = new THREE.MeshStandardMaterial({
        color: isGiant ? 0x8f241e : 0xb85d2e,
        roughness: 0.55,
        metalness: 0.1
      });
      const bagBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56 * scale, 0.62 * scale, 1.75 * scale, 16),
        bagMat
      );
      bagBody.position.y = -1.42 * scale;
      pivotGroup.add(bagBody);

      // Bandage tape & angry stitched X eyes
      const tapeMat = new THREE.MeshStandardMaterial({ color: 0xf4ebd9, roughness: 0.7 });
      const tape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.59 * scale, 0.6 * scale, 0.35 * scale, 16),
        tapeMat
      );
      tape.position.y = -1.25 * scale;
      pivotGroup.add(tape);

      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const eyeL = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * scale, 0.06 * scale, 0.06 * scale),
        eyeMat
      );
      eyeL.position.set(-0.22 * scale, -1.25 * scale, 0.58 * scale);
      eyeL.rotation.z = -0.35;
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.22 * scale;
      eyeR.rotation.z = 0.35;
      pivotGroup.add(eyeL, eyeR);

      return parts;
    }

    if (modelType === 'hard_referee') {
      parts.hudHeight = 3.2;

      // Blocky Armored Referee Robot with Black & White Stripes
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x181824,
        metalness: 0.6,
        roughness: 0.3
      });
      const whiteMat = new THREE.MeshStandardMaterial({
        color: 0xf0f4f8,
        metalness: 0.3,
        roughness: 0.3
      });

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.75, 0.42), darkMat);
      legL.position.set(-0.28, 0.38, 0);
      const legR = legL.clone();
      legR.position.x = 0.28;
      container.add(legL, legR);

      // Striped torso segments
      for (let i = 0; i < 5; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 1.15, 0.74),
          i % 2 === 0 ? darkMat : whiteMat
        );
        stripe.position.set((i - 2) * 0.24, 1.32, 0);
        container.add(stripe);
      }

      // Robot Head + Glowing Red Visor + Golden Whistle
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.68, 0.72), darkMat);
      head.position.y = 2.26;
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.16, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xff1e42 })
      );
      visor.position.set(0, 2.28, 0.36);

      const whistle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.26, 10),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.85, roughness: 0.2 })
      );
      whistle.rotation.x = Math.PI / 2;
      whistle.position.set(0, 2.04, 0.44);
      container.add(head, visor, whistle);

      // Glowing Cyan Riot Shield on Front Arm
      const shieldGroup = new THREE.Group();
      shieldGroup.position.set(0.75, 1.35, 0.45);
      const riotShield = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.55, 0.14),
        new THREE.MeshStandardMaterial({
          color: 0x00d9ff,
          emissive: 0x0088ff,
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.78
        })
      );
      const shieldFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.02, 1.62, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x22293a, metalness: 0.8 })
      );
      shieldGroup.add(riotShield, shieldFrame);
      container.add(shieldGroup);
      parts.riotShield = shieldGroup;

      return parts;
    }

    if (modelType === 'counter_punk') {
      parts.hudHeight = 3.15;

      // Spiky Punk Fighter with Glowing Red Counter-Aura Spikes
      const leatherMat = new THREE.MeshStandardMaterial({
        color: 0x251438,
        roughness: 0.4,
        metalness: 0.35
      });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.15, 0.68), leatherMat);
      torso.position.y = 1.15;
      container.add(torso);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.68, 0.68),
        new THREE.MeshStandardMaterial({ color: 0xe6b89c })
      );
      head.position.y = 2.08;
      container.add(head);

      // Neon Mohawk & Red Aura Spikes
      const spikeMat = new THREE.MeshStandardMaterial({
        color: 0xff1144,
        emissive: 0xff0033,
        emissiveIntensity: 0.9
      });
      const spikeGroup = new THREE.Group();
      container.add(spikeGroup);
      parts.auraSpikes = spikeGroup;

      // Mohawk spikes
      for (let i = 0; i < 4; i++) {
        const mohawk = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.58, 6), spikeMat);
        mohawk.position.set(0, 2.55 - i * 0.08, 0.18 - i * 0.2);
        mohawk.rotation.x = -0.25 * i;
        spikeGroup.add(mohawk);
      }

      // Shoulder & Back Counter Spikes
      const spikePositions = [
        [-0.75, 1.65, 0, 0, 0, 0.9],
        [0.75, 1.65, 0, 0, 0, -0.9],
        [-0.65, 1.15, 0.35, 0.7, 0, 0.7],
        [0.65, 1.15, 0.35, 0.7, 0, -0.7]
      ];
      spikePositions.forEach(([sx, sy, sz, rx, ry, rz]) => {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.68, 6), spikeMat);
        sp.position.set(sx, sy, sz);
        sp.rotation.set(rx, ry, rz);
        spikeGroup.add(sp);
      });

      return parts;
    }

    if (modelType === 'bomber_man') {
      parts.hudHeight = 3.0;

      // Round Bomb-Bodied Mascot with Sputtering Sparking Fuse on Top
      const bombMat = new THREE.MeshStandardMaterial({
        color: 0x1b1e2b,
        metalness: 0.7,
        roughness: 0.25
      });
      const bombSphere = new THREE.Mesh(new THREE.SphereGeometry(0.98, 22, 18), bombMat);
      bombSphere.position.y = 1.22;
      container.add(bombSphere);
      parts.bombBody = bombSphere;

      // Cute Mascot Boots
      const bootMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.35 });
      const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.62), bootMat);
      bootL.position.set(-0.38, 0.18, 0.1);
      const bootR = bootL.clone();
      bootR.position.x = 0.38;
      container.add(bootL, bootR);

      // Glowing Mascot Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      const eyeL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), eyeMat);
      eyeL.rotation.x = Math.PI / 2;
      eyeL.position.set(-0.3, 1.32, 0.92);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.3;
      container.add(eyeL, eyeR);

      // Fuse Cap + Sparking Fuse Ball
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.32, 0.25, 12),
        new THREE.MeshStandardMaterial({ color: 0x6c758a, metalness: 0.8 })
      );
      cap.position.y = 2.2;
      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9c29c })
      );
      rope.position.set(0, 2.48, -0.05);
      rope.rotation.x = -0.25;

      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
      const sparkBall = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), sparkMat);
      sparkBall.position.set(0, 2.72, -0.12);
      container.add(cap, rope, sparkBall);
      parts.fuseSpark = sparkBall;

      return parts;
    }

    if (modelType === 'encore_slime') {
      parts.hudHeight = 2.85;

      // Glossy Bouncy Gelatinous Cube/Slime Creature with Floating Crown
      const slimeGroup = new THREE.Group();
      container.add(slimeGroup);
      parts.slimeBody = slimeGroup;

      const outerMat = new THREE.MeshStandardMaterial({
        color: 0x10f58c,
        emissive: 0x00aa55,
        emissiveIntensity: 0.35,
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.78
      });
      const outerMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), outerMat);
      outerMesh.position.y = 1.05;
      slimeGroup.add(outerMesh);

      // Floating nucleus core inside slime
      const coreMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xaaffdd })
      );
      coreMesh.position.y = 1.05;
      slimeGroup.add(coreMesh);

      // Googly cartoon eyes
      const whiteEye = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
      [-0.32, 0.32].forEach((ex) => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), whiteEye);
        e.position.set(ex, 1.25, 0.88);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), pupilMat);
        p.position.set(ex, 1.25, 1.03);
        slimeGroup.add(e, p);
      });

      // Floating Golden Crown
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.3, 0.35, 6),
        new THREE.MeshStandardMaterial({
          color: 0xffd000,
          emissive: 0xff9900,
          emissiveIntensity: 0.4,
          metalness: 0.85,
          roughness: 0.2
        })
      );
      crown.position.y = 2.38;
      container.add(crown);
      parts.crown = crown;

      return parts;
    }

    if (modelType === 'whistle_enforcer') {
      parts.hudHeight = 3.55;

      // Tall Floating Security Mech with Spinning Police Siren Light
      const hoverGroup = new THREE.Group();
      container.add(hoverGroup);
      parts.hoverGroup = hoverGroup;

      const mechMat = new THREE.MeshStandardMaterial({
        color: 0x2c3854,
        metalness: 0.8,
        roughness: 0.25
      });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.38, 1.85, 8), mechMat);
      body.position.y = 1.75;
      hoverGroup.add(body);

      // Thruster glow ring underneath
      const thruster = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.48, 16),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
      );
      thruster.rotation.x = Math.PI / 2;
      thruster.position.y = 0.8;
      hoverGroup.add(thruster);

      // Megaphone / Whistle Blasters on both shoulders
      const hornMat = new THREE.MeshStandardMaterial({
        color: 0xffbb00,
        metalness: 0.8,
        roughness: 0.2
      });
      [-0.82, 0.82].forEach((hx) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 12), hornMat);
        horn.rotation.x = -Math.PI / 2;
        horn.position.set(hx, 2.0, 0.25);
        hoverGroup.add(horn);
      });

      // Spinning Red/Blue Police Siren Beacon on top
      const sirenGroup = new THREE.Group();
      sirenGroup.position.y = 2.82;
      const redLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.34, 0.28),
        new THREE.MeshBasicMaterial({ color: 0xff0044 })
      );
      redLight.position.x = -0.14;
      const blueLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.34, 0.28),
        new THREE.MeshBasicMaterial({ color: 0x00ccff })
      );
      blueLight.position.x = 0.14;
      sirenGroup.add(redLight, blueLight);
      hoverGroup.add(sirenGroup);
      parts.siren = sirenGroup;

      return parts;
    }

    // Default / 'chief_referee' (BOSS): Massive Hulking Mecha-Chief Referee!
    parts.hudHeight = 4.65;
    const bossScale = 1.32;

    const armorDark = new THREE.MeshStandardMaterial({
      color: 0x151324,
      metalness: 0.75,
      roughness: 0.25
    });
    const armorWhite = new THREE.MeshStandardMaterial({
      color: 0xf0f4ff,
      metalness: 0.35,
      roughness: 0.25
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xff8800,
      emissiveIntensity: 0.35,
      metalness: 0.88,
      roughness: 0.18
    });

    // Massive Mecha Legs
    [-0.55, 0.55].forEach((lx) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.58 * bossScale, 1.05 * bossScale, 0.65 * bossScale),
        armorDark
      );
      leg.position.set(lx * bossScale, 0.52 * bossScale, 0);
      container.add(leg);
    });

    // Striped Hulking Chest Armor
    for (let i = 0; i < 7; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.28 * bossScale, 1.45 * bossScale, 1.05 * bossScale),
        i % 2 === 0 ? armorDark : armorWhite
      );
      stripe.position.set((i - 3) * 0.28 * bossScale, 1.72 * bossScale, 0);
      container.add(stripe);
    }

    // Golden Shoulder Pauldrons
    [-1.25, 1.25].forEach((sx) => {
      const pauldron = new THREE.Mesh(
        new THREE.BoxGeometry(0.68 * bossScale, 0.62 * bossScale, 0.92 * bossScale),
        goldMat
      );
      pauldron.position.set(sx * bossScale, 2.25 * bossScale, 0);
      container.add(pauldron);
    });

    // Mecha Head + Glowing Crimson Visor + Referee Cap Crest
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.95 * bossScale, 0.82 * bossScale, 0.88 * bossScale),
      armorDark
    );
    head.position.y = 2.82 * bossScale;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.88 * bossScale, 0.22 * bossScale, 0.1 * bossScale),
      new THREE.MeshBasicMaterial({ color: 0xff003c })
    );
    visor.position.set(0, 2.84 * bossScale, 0.44 * bossScale);
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.24 * bossScale, 0.38 * bossScale, 0.95 * bossScale),
      goldMat
    );
    crest.position.set(0, 3.3 * bossScale, 0);
    container.add(head, visor, crest);

    // Giant Golden Whistle Cannon on Right Arm
    const cannonGroup = new THREE.Group();
    cannonGroup.position.set(1.42 * bossScale, 1.65 * bossScale, 0.45 * bossScale);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36 * bossScale, 0.42 * bossScale, 1.35 * bossScale, 14),
      goldMat
    );
    barrel.rotation.x = Math.PI / 2;
    const muzzle = new THREE.Mesh(
      new THREE.RingGeometry(0.15 * bossScale, 0.34 * bossScale, 14),
      new THREE.MeshBasicMaterial({ color: 0xff2a6d, side: THREE.DoubleSide })
    );
    muzzle.position.z = 0.68 * bossScale;
    cannonGroup.add(barrel, muzzle);
    container.add(cannonGroup);

    // Floating Red Penalty Cards Orbiting the Boss!
    const orbitGroup = new THREE.Group();
    orbitGroup.position.y = 2.0 * bossScale;
    const cardGeo = new THREE.BoxGeometry(0.45, 0.68, 0.05);
    const redCardMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const yellowCardMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const card = new THREE.Mesh(cardGeo, i % 3 === 0 ? yellowCardMat : redCardMat);
      card.position.set(Math.cos(angle) * 2.25, Math.sin(angle * 2) * 0.35, Math.sin(angle) * 2.25);
      card.rotation.y = -angle;
      orbitGroup.add(card);
    }
    container.add(orbitGroup);
    parts.orbitCards = orbitGroup;

    return parts;
  }

  // ============================================================================
  // Screen-Space Projection & 3D Raycast Selection
  // ============================================================================

  /**
   * Returns `{ [enemyId]: { x, y, bottomY, visible } }` in screen pixels relative to the container
   * so the 2D HUD can anchor crisp HP bars, intent badges, and status icons directly above each 3D enemy!
   */
  getEnemyScreenPositions() {
    const result = {};
    if (!this.camera) return result;

    const w = (this.container && this.container.clientWidth) || this.width;
    const h = (this.container && this.container.clientHeight) || this.height;

    const topVec = new THREE.Vector3();
    const baseVec = new THREE.Vector3();

    for (const [id, rec] of this.enemies.entries()) {
      rec.root.getWorldPosition(baseVec);
      topVec.copy(baseVec);
      topVec.y += rec.hudHeight || 3.1;

      topVec.project(this.camera);
      baseVec.project(this.camera);

      const visible = topVec.z >= -1 && topVec.z <= 1;
      const x = (topVec.x * 0.5 + 0.5) * w;
      const y = (-(topVec.y * 0.5) + 0.5) * h;
      const bottomY = (-(baseVec.y * 0.5) + 0.5) * h;

      result[id] = {
        x: Math.round(x),
        y: Math.round(y),
        bottomY: Math.round(bottomY),
        visible
      };
    }

    return result;
  }

  _onPointerDown(event) {
    if (this.enemies.size === 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    this.pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    const pickables = [];
    for (const rec of this.enemies.values()) {
      pickables.push(...rec.meshes);
    }

    const intersects = this.raycaster.intersectObjects(pickables, false);
    if (intersects.length > 0) {
      const hitEnemyId = intersects[0].object.userData.enemyId;
      if (hitEnemyId && this.enemies.has(hitEnemyId)) {
        this.setSelectedEnemy(hitEnemyId);
        if (typeof this.onSelectEnemy === 'function') {
          this.onSelectEnemy(hitEnemyId);
        }
      }
    }
  }

  // ============================================================================
  // Maximum Juice & Physics Effects (Hits, Explosions, Ragdoll Kills, Attacks)
  // ============================================================================

  /**
   * Triggers hitstop, camera shake & combo zoom, squash-and-stretch deformation,
   * 80ms white flash material override, physical knockback impulse, and 3D burst particles!
   */
  triggerHit(enemyId, damage = 10, comboCount = 1, options = {}) {
    const rec = this.enemies.get(String(enemyId)) || this.enemies.values().next().value;
    const hitPos = new THREE.Vector3(3.2, 1.5, 0);

    if (rec) {
      rec.root.getWorldPosition(hitPos);
      hitPos.y += (rec.hudHeight || 2.8) * 0.48;

      // 1. 80ms White Flash Material Override
      rec.flashTimer = 0.08;
      rec.meshes.forEach((m) => {
        m.material = this.flashMaterial;
      });

      // 2. Squash-and-Stretch Deformation + Physical Knockback Impulse
      const isHeavy = damage >= 18 || comboCount >= 10 || options.isHeavy;
      rec.squashScale.set(isHeavy ? 1.48 : 1.32, isHeavy ? 0.62 : 0.72, isHeavy ? 1.48 : 1.32);

      const kbForce = Math.min(1.6, 0.38 + damage * 0.02 + comboCount * 0.015);
      rec.knockbackOffset.x += kbForce;
      rec.knockbackOffset.z += (Math.random() - 0.5) * 0.45;

      // Swing impulse for sandbags
      if (rec.parts && rec.parts.swingPivot) {
        rec.swingVel += Math.min(16, 5.5 + damage * 0.15 + comboCount * 0.2);
      }

      this.focusWorldPos.copy(hitPos);
    }

    // 3. Hitstop on heavy hits or combo milestones
    const isHeavyHit = damage >= 20 || comboCount % 10 === 0 || options.isHeavy;
    if (isHeavyHit) {
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.048);
    }

    // 4. Camera Shake + Dynamic Combo Zoom-In!
    const shakeBoost = Math.min(0.85, 0.12 + damage * 0.008 + comboCount * 0.014);
    this.shakeIntensity = Math.min(1.15, Math.max(this.shakeIntensity, shakeBoost));

    this.comboZoomTarget = Math.min(3.8, (comboCount - 1) * 0.11 + (isHeavyHit ? 0.55 : 0.2));
    this.comboZoomDecayTimer = 0.85;

    // 5. 3D Burst Particles (Sparks, Comic Stars, Shockwave Ring)
    const particleCount = Math.min(28, 12 + Math.floor(comboCount * 0.4));
    this._spawnHitParticles(hitPos, particleCount, comboCount, options.color);
    this._spawnShockwaveRing(
      hitPos,
      options.color || (comboCount >= 10 ? 0xff2a6d : 0xffbe0b),
      isHeavyHit ? 2.8 : 1.9
    );

    // Nudge nearby ring props slightly on heavy hits
    if (isHeavyHit) {
      this._scatterRingProps(hitPos, 3.5, 0.45);
    }
  }

  /**
   * Expanding fiery plasma sphere + shockwave torus ring + 40 flying debris cubes + scattering ring props!
   */
  triggerExplosion(centerEnemyId, damage = 25, comboCount = 1) {
    const rec =
      this.enemies.get(String(centerEnemyId)) || this.enemies.values().next().value;
    const centerPos = new THREE.Vector3(3.2, 1.3, 0);
    if (rec) {
      rec.root.getWorldPosition(centerPos);
      centerPos.y += 1.1;
    }

    this.focusWorldPos.copy(centerPos);
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.055);
    this.shakeIntensity = Math.min(1.35, Math.max(this.shakeIntensity, 0.65 + comboCount * 0.015));
    this.comboZoomTarget = Math.min(4.2, this.comboZoomTarget + 0.85);
    this.comboZoomDecayTimer = 1.05;

    // 1. Expanding Fiery Plasma Sphere
    const sphereGeo = new THREE.SphereGeometry(0.65, 18, 14);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending
    });
    const plasmaMesh = new THREE.Mesh(sphereGeo, sphereMat);
    plasmaMesh.position.copy(centerPos);
    this.scene.add(plasmaMesh);

    this.particles.push({
      kind: 'plasma',
      mesh: plasmaMesh,
      age: 0,
      maxAge: 0.42,
      maxScale: 4.4
    });

    // 2. Shockwave Torus Ring
    const torusGeo = new THREE.TorusGeometry(0.6, 0.11, 10, 28);
    const torusMat = new THREE.MeshBasicMaterial({
      color: 0xffbe0b,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.position.copy(centerPos);
    torusMesh.rotation.x = Math.PI / 2;
    this.scene.add(torusMesh);

    this.particles.push({
      kind: 'torus',
      mesh: torusMesh,
      age: 0,
      maxAge: 0.48,
      maxScale: 6.2
    });

    // 3. 40 Flying Debris Cubes with Gravity & Bounce Physics!
    const debrisColors = [0xff2a6d, 0xff7700, 0xffbe0b, 0xffffff, 0x00f0ff];
    const cubeGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);

    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: debrisColors[i % debrisColors.length]
      });
      const cube = new THREE.Mesh(cubeGeo, mat);
      cube.position.copy(centerPos);

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 8.5;
      const vy = 4.0 + Math.random() * 7.5;

      this.scene.add(cube);
      this.particles.push({
        kind: 'debris',
        mesh: cube,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, vy, Math.sin(angle) * speed),
        angularVel: new THREE.Vector3(
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 18
        ),
        age: 0,
        maxAge: 0.95 + Math.random() * 0.4
      });
    }

    // 4. Knock back all alive enemies & scatter 3D ring props!
    for (const enemyRec of this.enemies.values()) {
      enemyRec.flashTimer = 0.08;
      enemyRec.meshes.forEach((m) => {
        m.material = this.flashMaterial;
      });
      enemyRec.squashScale.set(1.45, 0.6, 1.45);
      enemyRec.knockbackOffset.x += 0.9;
    }

    this._scatterRingProps(centerPos, 11.0, 1.0);
  }

  /**
   * Dramatic Ragdoll Launch!
   * Launches the defeated 3D enemy spinning into the air off the ring (bouncing off floor/ropes with gravity)
   * while spawning a shower of golden coins & sparks, plus slow-motion (timeScale = 0.25 for 350ms)!
   */
  triggerEnemyKill(enemyId, overkillDamage = 0) {
    const id = String(enemyId);
    const rec = this.enemies.get(id);
    if (!rec) return;

    // Remove from active enemies map so it becomes a physics ragdoll
    this.enemies.delete(id);

    // Restore original materials before ragdoll launch
    rec.meshes.forEach((m) => {
      if (m.userData.origMaterial) {
        m.material = m.userData.origMaterial;
      }
    });

    const launchPos = new THREE.Vector3();
    rec.root.getWorldPosition(launchPos);

    // Dramatic slow-motion on boss kills, multi-kills, or big overkill
    const isBoss = rec.modelType === 'chief_referee';
    if (isBoss || overkillDamage >= 15 || this.ragdolls.length > 0 || this.enemies.size === 0) {
      this.timeScale = 0.25;
      this.slowMoTimer = 0.35; // 350ms real-time slow motion
    }

    this.shakeIntensity = Math.min(1.4, Math.max(this.shakeIntensity, isBoss ? 1.2 : 0.75));

    // Launch velocity up and away toward the right/back stadium bleachers
    const power = 1.0 + Math.min(1.2, overkillDamage * 0.025);
    const vel = new THREE.Vector3(
      (5.8 + Math.random() * 3.5) * power,
      (8.5 + Math.random() * 3.0) * power,
      (Math.random() - 0.5) * 7.5
    );
    const angVel = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 16,
      -10 - Math.random() * 10
    );

    this.ragdolls.push({
      root: rec.root,
      velocity: vel,
      angularVel: angVel,
      age: 0,
      maxAge: 2.2
    });

    // Spawn shower of golden arcade coins & KO star sparks!
    this._spawnCoinShower(launchPos.clone().add(new THREE.Vector3(0, 1.3, 0)), isBoss ? 36 : 22);
    this._spawnShockwaveRing(
      launchPos.clone().add(new THREE.Vector3(0, 1.2, 0)),
      0xffbe0b,
      isBoss ? 5.0 : 3.2
    );

    // Reassign selected enemy if needed
    if (this.selectedEnemyId === id) {
      const nextFirst = this.enemies.keys().next().value || null;
      this.setSelectedEnemy(nextFirst);
    }
  }

  /**
   * Player Attack Animations:
   * - Lunge punch / heavy strike
   * - Fires 3D glowing laser beam cylinder
   * - Throws 3D dynamite stick with parabolic arc
   * - Slams giant holographic shield
   * - Red Pen rule-rewrite diagonal slash across the arena
   */
  triggerPlayerAttackAnim(actionType = 'strike', targetEnemyId = null) {
    if (!this.player) return;

    const targetRec =
      (targetEnemyId && this.enemies.get(String(targetEnemyId))) ||
      (this.selectedEnemyId && this.enemies.get(this.selectedEnemyId)) ||
      this.enemies.values().next().value;

    const targetPos = new THREE.Vector3(3.2, 1.4, 0);
    if (targetRec) {
      targetRec.root.getWorldPosition(targetPos);
      targetPos.y += 1.2;
    }

    const typeKey = String(actionType).toLowerCase();

    if (typeKey.includes('laser') || typeKey.includes('beam')) {
      this.player.attackAnim = {
        type: 'lunge',
        timer: 0,
        duration: 0.28,
        targetPos: targetPos.clone()
      };
      this._spawnLaserBeam(
        this.player.root.position.clone().add(new THREE.Vector3(0.9, 1.5, 0)),
        targetPos
      );
    } else if (
      typeKey.includes('dynamite') ||
      typeKey.includes('bomb') ||
      typeKey.includes('throw')
    ) {
      this.player.attackAnim = {
        type: 'lunge',
        timer: 0,
        duration: 0.26,
        targetPos: targetPos.clone()
      };
      this._spawnDynamiteArc(
        this.player.root.position.clone().add(new THREE.Vector3(0.6, 1.8, 0)),
        targetPos
      );
    } else if (typeKey.includes('guard') || typeKey.includes('shield')) {
      this.player.attackAnim = {
        type: 'shield_slam',
        timer: 0,
        duration: 0.34,
        targetPos: targetPos.clone()
      };
      this.player.shieldDome.visible = true;
      this._spawnShockwaveRing(
        this.player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
        0x00f0ff,
        2.6
      );
    } else if (typeKey.includes('pen') || typeKey.includes('rule')) {
      this.player.attackAnim = {
        type: 'lunge',
        timer: 0,
        duration: 0.3,
        targetPos: targetPos.clone()
      };
      this.triggerRedPenSlash(targetPos);
    } else {
      // Standard or heavy melee lunge
      this.player.attackAnim = {
        type: 'lunge',
        timer: 0,
        duration: 0.24,
        targetPos: targetPos.clone()
      };
    }
  }

  /**
   * Triggers enemy hitting the player (recoil + camera shake + spark flash on player)
   */
  triggerPlayerDamage(damage = 10) {
    if (!this.player) return;
    this.player.recoilTimer = 0.24;
    this.shakeIntensity = Math.min(1.1, Math.max(this.shakeIntensity, 0.35 + damage * 0.015));
    const pPos = this.player.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this._spawnHitParticles(pPos, 16, 1, 0xff1e42);
  }

  /**
   * Dramatic 3D Red Pen diagonal slash across the 3D arena when rewriting a rule!
   */
  triggerRedPenSlash(centerPos = new THREE.Vector3(0, 2.2, 0.5)) {
    const slashGroup = new THREE.Group();
    slashGroup.position.copy(centerPos);

    const barGeo = new THREE.BoxGeometry(7.5, 0.26, 0.12);
    const barMat = new THREE.MeshBasicMaterial({
      color: 0xff003c,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending
    });

    const slash1 = new THREE.Mesh(barGeo, barMat);
    slash1.rotation.z = 0.38;
    const slash2 = new THREE.Mesh(barGeo, barMat.clone());
    slash2.rotation.z = -0.38;
    slashGroup.add(slash1, slash2);

    this.scene.add(slashGroup);
    this.particles.push({
      kind: 'red_pen_slash',
      mesh: slashGroup,
      age: 0,
      maxAge: 0.45
    });

    this.shakeIntensity = Math.max(this.shakeIntensity, 0.42);
  }

  // ============================================================================
  // 3D Particle & Projectile Spawners
  // ============================================================================

  _spawnHitParticles(origin, count = 14, comboCount = 1, customColor = null) {
    const palette = [0xffbe0b, 0xff2a6d, 0x00f0ff, 0xffffff];
    const starGeo = new THREE.OctahedronGeometry(0.18, 0);

    for (let i = 0; i < count; i++) {
      const color = customColor || palette[(i + comboCount) % palette.length];
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(starGeo, mat);
      mesh.position.copy(origin);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 2.8 + Math.random() * 6.5;

      this.scene.add(mesh);
      this.particles.push({
        kind: 'spark',
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(theta) * Math.sin(phi) * speed,
          Math.abs(Math.cos(phi)) * speed + 2.2,
          Math.sin(theta) * Math.sin(phi) * speed
        ),
        age: 0,
        maxAge: 0.36 + Math.random() * 0.22
      });
    }
  }

  _spawnShockwaveRing(origin, color = 0xffbe0b, maxScale = 2.4) {
    const ringGeo = new THREE.RingGeometry(0.35, 0.55, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.position.copy(origin);
    mesh.lookAt(this.camera.position);
    this.scene.add(mesh);

    this.particles.push({
      kind: 'shockwave',
      mesh,
      age: 0,
      maxAge: 0.28,
      maxScale
    });
  }

  _spawnLaserBeam(startPos, endPos) {
    const dir = new THREE.Vector3().subVectors(endPos, startPos);
    const length = Math.max(0.5, dir.length());
    const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);

    const beamGeo = new THREE.CylinderGeometry(0.22, 0.22, length, 12);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    const coreGeo = new THREE.CylinderGeometry(0.1, 0.1, length, 8);
    coreGeo.rotateX(Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const group = new THREE.Group();
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(beamMesh, coreMesh);

    group.position.copy(mid);
    group.lookAt(endPos);
    this.scene.add(group);

    this.particles.push({
      kind: 'laser',
      mesh: group,
      age: 0,
      maxAge: 0.24
    });
  }

  _spawnDynamiteArc(startPos, endPos) {
    const group = new THREE.Group();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.58, 10),
      new THREE.MeshStandardMaterial({ color: 0xff1e38, roughness: 0.4 })
    );
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd00 })
    );
    spark.position.y = 0.34;
    group.add(stick, spark);
    group.position.copy(startPos);
    this.scene.add(group);

    this.particles.push({
      kind: 'dynamite',
      mesh: group,
      startPos: startPos.clone(),
      endPos: endPos.clone(),
      age: 0,
      maxAge: 0.26
    });
  }

  _spawnCoinShower(origin, count = 20) {
    const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd000,
      emissive: 0xff9900,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.15
    });

    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.position.copy(origin);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.5;
      const vy = 4.5 + Math.random() * 6.5;

      this.scene.add(coin);
      this.particles.push({
        kind: 'debris',
        mesh: coin,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, vy, Math.sin(angle) * speed),
        angularVel: new THREE.Vector3(12, 8, 15),
        age: 0,
        maxAge: 1.05
      });
    }
  }

  _scatterRingProps(blastOrigin, radius = 9.0, forceMult = 1.0) {
    this.ringProps.forEach((prop) => {
      const dist = prop.mesh.position.distanceTo(blastOrigin);
      if (dist <= radius) {
        const dir = new THREE.Vector3()
          .subVectors(prop.mesh.position, blastOrigin)
          .normalize();
        const strength = (1 - dist / (radius + 1)) * 6.5 * forceMult;
        prop.velocity.set(
          dir.x * strength + (Math.random() - 0.5) * 2.5,
          3.8 * forceMult + Math.random() * 3.5,
          dir.z * strength + (Math.random() - 0.5) * 2.5
        );
        prop.angularVel.set(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14
        );
        prop.isAirborne = true;
      }
    });
  }

  // ============================================================================
  // Main 60FPS Update & Render Loop
  // ============================================================================

  _animate() {
    this._animFrameId = requestAnimationFrame(this._animateBound);

    const rawDt = Math.min(0.05, this.clock.getDelta());

    // Handle Slow-Mo timer (real time)
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= rawDt;
      if (this.slowMoTimer <= 0) {
        this.timeScale = 1.0;
      }
    }

    // Handle Hitstop freeze timer (real time)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= rawDt;
      this._updateCamera(rawDt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const dt = rawDt * this.timeScale;
    this.elapsedTime += dt;

    this._updateEnvironment(dt);
    this._updatePlayer(dt);
    this._updateEnemies(dt);
    this._updateRagdolls(dt);
    this._updateRingProps(dt);
    this._updateParticles(dt);
    this._updateTargetRing(dt);
    this._updateCamera(rawDt);

    this.renderer.render(this.scene, this.camera);
  }

  _updateEnvironment(dt) {
    const t = this.elapsedTime;

    // Sweep stadium spotlights gently
    this.spotlights.forEach((s) => {
      s.mesh.rotation.z = s.baseRotZ + Math.sin(t * 1.1 + s.phase) * 0.14;
    });

    // Drift floating neon motes
    if (this.floatingMotes) {
      this.floatingMotes.rotation.y = t * 0.05;
      this.floatingMotes.position.y = Math.sin(t * 0.8) * 0.25;
    }
  }

  _updatePlayer(dt) {
    if (!this.player) return;
    const p = this.player;
    const t = this.elapsedTime;

    // Idle brawler breathing & headband flutter
    const breath = Math.sin(t * 4.2);
    p.bodyGroup.position.y = breath * 0.06;
    p.bodyGroup.scale.set(1 - breath * 0.02, 1 + breath * 0.03, 1 - breath * 0.02);

    p.leftFist.position.y = 1.32 + Math.sin(t * 4.2 + 0.8) * 0.09;
    p.rightFist.position.y = 1.32 + Math.cos(t * 4.2) * 0.09;

    p.tail1.rotation.x = 0.55 + Math.sin(t * 7.5) * 0.22;
    p.tail2.rotation.x = 0.55 + Math.cos(t * 7.5) * 0.22;

    if (p.shieldDome.visible) {
      p.shieldDome.rotation.y += dt * 1.8;
      const pulse = 1 + Math.sin(t * 6) * 0.04;
      p.shieldDome.scale.set(pulse, pulse, pulse);
    }

    // Attack Lunge / Shield Slam Animation
    if (p.attackAnim) {
      p.attackAnim.timer += dt;
      const prog = Math.min(1, p.attackAnim.timer / p.attackAnim.duration);

      if (p.attackAnim.type === 'lunge') {
        const thrust = Math.sin(prog * Math.PI);
        p.root.position.x = p.homePos.x + thrust * 2.35;
        p.root.position.z = THREE.MathUtils.lerp(
          p.homePos.z,
          p.attackAnim.targetPos.z * 0.45,
          thrust
        );
        p.rightFist.position.z = 0.45 + thrust * 0.95;
        p.rightFist.scale.setScalar(1 + thrust * 0.45);
      } else if (p.attackAnim.type === 'shield_slam') {
        const bounce = Math.sin(prog * Math.PI);
        p.root.position.y = p.homePos.y + bounce * 0.65;
        p.shieldDome.scale.setScalar(1 + bounce * 0.35);
      }

      if (prog >= 1) {
        p.root.position.copy(p.homePos);
        p.rightFist.position.z = 0.45;
        p.rightFist.scale.setScalar(1);
        p.attackAnim = null;
      }
    } else if (p.recoilTimer > 0) {
      p.recoilTimer -= dt;
      p.root.position.x = p.homePos.x - Math.sin((p.recoilTimer / 0.24) * Math.PI) * 0.75;
    } else {
      p.root.position.lerp(p.homePos, Math.min(1, dt * 12));
    }
  }

  _updateEnemies(dt) {
    const t = this.elapsedTime;

    for (const rec of this.enemies.values()) {
      // 1. White Flash Timer (80ms)
      if (rec.flashTimer > 0) {
        rec.flashTimer -= dt;
        if (rec.flashTimer <= 0) {
          rec.meshes.forEach((m) => {
            if (m.userData.origMaterial) {
              m.material = m.userData.origMaterial;
            }
          });
        }
      }

      // 2. Squash & Stretch elastic recovery
      rec.squashScale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 16));
      rec.animGroup.scale.copy(rec.squashScale);

      // 3. Knockback spring return to slot homePos
      rec.knockbackOffset.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 11));
      rec.root.position.copy(rec.homePos).add(rec.knockbackOffset);

      // 4. Model-specific procedural idle & reactive animations
      const phase = t * 3.8 + rec.phaseOffset;

      if (rec.parts.swingPivot) {
        // Sandbag pendulum physics when hit!
        const springK = 38;
        const damping = 4.2;
        const accel = -springK * rec.swingAngle - damping * rec.swingVel;
        rec.swingVel += accel * dt;
        rec.swingAngle += rec.swingVel * dt;
        rec.parts.swingPivot.rotation.z =
          rec.swingAngle + Math.sin(phase * 0.7) * 0.04;
      } else {
        rec.animGroup.position.y = Math.abs(Math.sin(phase)) * 0.08;
      }

      if (rec.parts.auraSpikes) {
        const spikePulse = 1 + Math.sin(t * 9 + rec.phaseOffset) * 0.14;
        rec.parts.auraSpikes.scale.setScalar(spikePulse);
      }

      if (rec.parts.fuseSpark) {
        // Bomber Man fuse pulses faster at low HP!
        const hpRatio =
          rec.data && rec.data.maxHp ? Math.max(0.1, rec.data.hp / rec.data.maxHp) : 1;
        const speed = hpRatio < 0.4 ? 26 : 12;
        const s = 1 + Math.sin(t * speed) * 0.38;
        rec.parts.fuseSpark.scale.setScalar(s);
      }

      if (rec.parts.slimeBody) {
        // Encore Slime jiggle & floating crown
        const jiggle = Math.sin(t * 6.5 + rec.phaseOffset);
        rec.parts.slimeBody.scale.set(
          1 + jiggle * 0.08,
          1 - jiggle * 0.09,
          1 + jiggle * 0.08
        );
        if (rec.parts.crown) {
          rec.parts.crown.position.y = 2.38 + Math.sin(t * 5) * 0.12;
          rec.parts.crown.rotation.y += dt * 1.5;
        }
      }

      if (rec.parts.hoverGroup) {
        // Whistle Enforcer hover & spinning siren light
        rec.parts.hoverGroup.position.y = Math.sin(t * 3.5 + rec.phaseOffset) * 0.22;
        if (rec.parts.siren) {
          rec.parts.siren.rotation.y += dt * 12;
        }
      }

      if (rec.parts.orbitCards) {
        // Boss Chief Referee orbiting penalty cards
        rec.parts.orbitCards.rotation.y += dt * 2.2;
      }
    }
  }

  _updateRagdolls(dt) {
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const rag = this.ragdolls[i];
      rag.age += dt;

      // Gravity + trajectory
      rag.velocity.y -= 22.0 * dt;
      rag.root.position.addScaledVector(rag.velocity, dt);

      // Spin wildly
      rag.root.rotation.x += rag.angularVel.x * dt;
      rag.root.rotation.y += rag.angularVel.y * dt;
      rag.root.rotation.z += rag.angularVel.z * dt;

      // Bounce off ring mat or stadium floor
      const floorY =
        Math.abs(rag.root.position.x) < 6.2 && Math.abs(rag.root.position.z) < 4.2
          ? 0.2
          : -0.9;
      if (rag.root.position.y < floorY && rag.velocity.y < 0) {
        rag.root.position.y = floorY;
        rag.velocity.y *= -0.55;
        rag.velocity.x *= 0.78;
        rag.velocity.z *= 0.78;
      }

      if (rag.age >= rag.maxAge) {
        this.scene.remove(rag.root);
        this.ragdolls.splice(i, 1);
      }
    }
  }

  _updateRingProps(dt) {
    this.ringProps.forEach((prop) => {
      if (!prop.isAirborne) return;

      prop.velocity.y -= 19.5 * dt;
      prop.mesh.position.addScaledVector(prop.velocity, dt);
      prop.mesh.rotation.x += prop.angularVel.x * dt;
      prop.mesh.rotation.y += prop.angularVel.y * dt;
      prop.mesh.rotation.z += prop.angularVel.z * dt;

      const onRing =
        Math.abs(prop.mesh.position.x) < 6.0 && Math.abs(prop.mesh.position.z) < 4.0;
      const floorY = onRing ? 0.18 : -0.92;

      if (prop.mesh.position.y <= floorY && prop.velocity.y < 0) {
        prop.mesh.position.y = floorY;
        prop.velocity.y *= -0.45;
        prop.velocity.x *= 0.7;
        prop.velocity.z *= 0.7;
        prop.angularVel.multiplyScalar(0.65);

        if (Math.abs(prop.velocity.y) < 0.4 && prop.velocity.lengthSq() < 0.2) {
          prop.isAirborne = false;
        }
      }
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      const prog = Math.min(1, p.age / p.maxAge);

      if (p.kind === 'spark') {
        p.velocity.y -= 14.0 * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.rotation.x += 10 * dt;
        p.mesh.rotation.y += 12 * dt;
        p.mesh.scale.setScalar(1 - prog);
      } else if (p.kind === 'debris') {
        p.velocity.y -= 21.0 * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.rotation.x += p.angularVel.x * dt;
        p.mesh.rotation.y += p.angularVel.y * dt;
        p.mesh.rotation.z += p.angularVel.z * dt;

        const floorY =
          Math.abs(p.mesh.position.x) < 6.1 && Math.abs(p.mesh.position.z) < 4.1
            ? 0.16
            : -0.95;
        if (p.mesh.position.y < floorY && p.velocity.y < 0) {
          p.mesh.position.y = floorY;
          p.velocity.y *= -0.52;
          p.velocity.x *= 0.75;
          p.velocity.z *= 0.75;
        }
        if (prog > 0.7) {
          p.mesh.scale.setScalar((1 - prog) / 0.3);
        }
      } else if (p.kind === 'shockwave' || p.kind === 'plasma' || p.kind === 'torus') {
        const scale = 1 + prog * (p.maxScale - 1);
        p.mesh.scale.setScalar(scale);
        if (p.mesh.material) {
          p.mesh.material.opacity = (1 - prog) * 0.9;
        }
      } else if (p.kind === 'laser') {
        const s = 1 - prog;
        p.mesh.scale.set(s, s, 1);
      } else if (p.kind === 'dynamite') {
        // Parabolic arc from player to target enemy
        p.mesh.position.lerpVectors(p.startPos, p.endPos, prog);
        p.mesh.position.y += Math.sin(prog * Math.PI) * 2.6;
        p.mesh.rotation.z -= 18 * dt;
      } else if (p.kind === 'red_pen_slash') {
        p.mesh.scale.setScalar(1 + prog * 0.35);
        p.mesh.children.forEach((c) => {
          if (c.material) c.material.opacity = 1 - prog;
        });
      }

      if (p.age >= p.maxAge) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  _updateTargetRing(dt) {
    if (!this.targetRing) return;
    const rec = this.selectedEnemyId ? this.enemies.get(this.selectedEnemyId) : null;
    if (!rec) {
      this.targetRing.visible = false;
      return;
    }

    this.targetRing.visible = true;
    this.targetRing.position.x = rec.root.position.x;
    this.targetRing.position.z = rec.root.position.z;
    this.targetRing.rotation.y += dt * 2.2;

    const pulse = (rec.modelType === 'chief_referee' ? 1.45 : 1.0) + Math.sin(this.elapsedTime * 7) * 0.08;
    this.targetRing.scale.set(pulse, 1, pulse);
  }

  _updateCamera(rawDt) {
    // Decay combo zoom back to 0 when combo chain pauses
    if (this.comboZoomDecayTimer > 0) {
      this.comboZoomDecayTimer -= rawDt;
    } else {
      this.comboZoomTarget = Math.max(0, this.comboZoomTarget - rawDt * 2.8);
    }

    this.comboZoomCurrent = THREE.MathUtils.lerp(
      this.comboZoomCurrent,
      this.comboZoomTarget,
      Math.min(1, rawDt * 8)
    );

    // Compute zoomed camera target toward the active action focus point
    const zoomFactor = this.comboZoomCurrent * 0.14;
    const desiredCamPos = new THREE.Vector3().lerpVectors(
      this.baseCamPos,
      new THREE.Vector3(
        this.focusWorldPos.x * 0.55,
        this.baseCamPos.y - 1.2,
        this.baseCamPos.z - 5.5
      ),
      Math.min(0.55, zoomFactor)
    );

    // Apply punchy camera shake
    if (this.shakeIntensity > 0.001) {
      desiredCamPos.x += (Math.random() - 0.5) * this.shakeIntensity * 0.9;
      desiredCamPos.y += (Math.random() - 0.5) * this.shakeIntensity * 0.9;
      desiredCamPos.z += (Math.random() - 0.5) * this.shakeIntensity * 0.4;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - rawDt * 3.8);
    }

    this.camera.position.copy(desiredCamPos);

    const desiredLook = new THREE.Vector3().lerpVectors(
      this.baseLookAt,
      this.focusWorldPos,
      Math.min(0.45, zoomFactor)
    );
    this.currentLookAt.lerp(desiredLook, Math.min(1, rawDt * 12));
    this.camera.lookAt(this.currentLookAt);
  }

  // ============================================================================
  // Resize & Cleanup
  // ============================================================================

  _applyResponsiveCameraFraming() {
    if (!this.camera) return;
    const aspect = this.width / Math.max(1, this.height);
    if (aspect < 0.95) {
      // Portrait mobile: scale distance inversely with aspect so Hero (left) & all Enemies (right) fit cleanly!
      const clampedAspect = Math.max(0.52, Math.min(0.95, aspect));
      this.camera.fov = 54;
      this.baseCamPos.set(0.0, 8.8, 16.2 / clampedAspect);
      this.baseLookAt.set(0.0, 0.15, -0.2);
    } else {
      this.camera.fov = 42;
      this.baseCamPos.set(0, 6.8, 16.5);
      this.baseLookAt.set(0.4, 0.85, -0.3);
    }
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;
    this.width = (this.container && this.container.clientWidth) || window.innerWidth || 1280;
    this.height = (this.container && this.container.clientHeight) || window.innerHeight || 720;

    this._applyResponsiveCameraFraming();
    this.renderer.setSize(this.width, this.height);
  }

  resize() {
    this.handleResize();
  }

  destroy() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
    }
    window.removeEventListener('resize', this._onResizeBound);
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDownBound);
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

export default Arena3D;
