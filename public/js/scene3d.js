// Three.js interactive 3D AMC Mail Core and ambient sky-crystal depth layer.
// Loaded asynchronously as an ES module with automatic fallback if WebGL is unavailable.

const THREE_CDNS = [
  'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
  'https://unpkg.com/three@0.170.0/build/three.module.js',
];

function createFallbackVisual(heroCanvas, ambientCanvas, prefersReduced) {
  if (!heroCanvas) {
    return {
      pulse() {},
      setTheme() {},
      setDomainCount() {},
      setPaused() {},
      isPaused() { return true; },
    };
  }
  const ctx = heroCanvas.getContext('2d');
  if (!ctx) {
    return {
      pulse() {},
      setTheme() {},
      setDomainCount() {},
      setPaused() {},
      isPaused() { return true; },
    };
  }
  heroCanvas.setAttribute('data-renderer', 'canvas2d');

  let isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  let paused = Boolean(prefersReduced);
  let domainCount = 6;
  let angle = 0;
  let pulseAlpha = 0;
  let pulseColor = '#38bdf8';
  let dragTilt = 0;
  let rafId = null;

  function resize() {
    const rect = heroCanvas.parentElement?.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect?.width || 280));
    const h = Math.max(170, Math.round(rect?.height || 220));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    heroCanvas.width = Math.round(w * dpr);
    heroCanvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  if (typeof ResizeObserver !== 'undefined' && heroCanvas.parentElement) {
    new ResizeObserver(() => {
      resize();
      draw();
    }).observe(heroCanvas.parentElement);
  }

  heroCanvas.addEventListener('pointermove', (e) => {
    const rect = heroCanvas.getBoundingClientRect();
    if (!rect.width) return;
    dragTilt = (((e.clientX - rect.left) / rect.width) - 0.5) * 0.25;
    if (paused) draw();
  });
  heroCanvas.addEventListener('pointerleave', () => {
    dragTilt = 0;
    if (paused) draw();
  });

  function draw() {
    const rect = heroCanvas.parentElement?.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect?.width || 280));
    const h = Math.max(170, Math.round(rect?.height || 220));
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 - 8;
    const bob = Math.sin(angle * 1.4) * 4;

    // Soft sky aura behind envelope
    const glow = ctx.createRadialGradient(cx, cy + bob, 12, cx, cy + bob, 96);
    glow.addColorStop(0, isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(56, 189, 248, 0.24)');
    glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, 96, 0, Math.PI * 2);
    ctx.fill();

    // Dual orbital routing rings
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(-0.22 + dragTilt);
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.42)' : 'rgba(2, 132, 199, 0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 94, 34, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(0.48);
    ctx.strokeStyle = isDark ? 'rgba(125, 211, 252, 0.28)' : 'rgba(56, 189, 248, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 82, 27, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Orbiting domain satellite nodes
    const count = Math.max(3, Math.min(10, domainCount));
    for (let i = 0; i < count; i++) {
      const a = angle + (i / count) * Math.PI * 2;
      const sx = Math.cos(a) * 90;
      const sy = Math.sin(a) * 32;
      ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#7dd3fc';
      ctx.beginPath();
      ctx.arc(sx, sy, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Pulse ring on mail events
    if (pulseAlpha > 0.02) {
      const r = 46 + (1 - pulseAlpha) * 58;
      ctx.strokeStyle = pulseColor;
      ctx.globalAlpha = pulseAlpha;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Crystal glass AMC envelope
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(dragTilt * 0.45);
    const grad = ctx.createLinearGradient(-56, -36, 56, 36);
    grad.addColorStop(0, isDark ? '#38bdf8' : '#7dd3fc');
    grad.addColorStop(0.55, isDark ? '#0284c7' : '#0ea5e9');
    grad.addColorStop(1, isDark ? '#0369a1' : '#0277b5');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-56, -36, 112, 72, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-50, -30);
    ctx.lineTo(0, 6);
    ctx.lineTo(50, -30);
    ctx.stroke();

    // Luminous center diamond seal
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(8, 6);
    ctx.lineTo(0, 16);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function step() {
    angle += 0.016;
    if (pulseAlpha > 0) pulseAlpha = Math.max(0, pulseAlpha - 0.028);
    draw();
    if (!paused && document.visibilityState === 'visible') {
      rafId = requestAnimationFrame(step);
    } else {
      rafId = null;
    }
  }

  function start() {
    if (paused || rafId !== null) return;
    rafId = requestAnimationFrame(step);
  }

  draw();
  if (!paused) start();

  if (ambientCanvas) {
    const actx = ambientCanvas.getContext('2d');
    if (actx) actx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);
  }

  return {
    pulse(kind = 'inbox') {
      const colors = { generate: '#38bdf8', inbox: '#0ea5e9', otp: '#10b981', bounce: '#ef4444' };
      pulseColor = colors[kind] || '#38bdf8';
      pulseAlpha = 0.85;
      draw();
    },
    setTheme(theme) {
      isDark = theme === 'dark';
      draw();
    },
    setDomainCount(count) {
      domainCount = Number(count) || 6;
      draw();
    },
    setPaused(nextPaused) {
      paused = Boolean(nextPaused);
      if (paused) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        draw();
      } else {
        start();
      }
    },
    isPaused() {
      return paused;
    },
  };
}

async function loadThreeModule() {
  for (const url of THREE_CDNS) {
    try {
      return await import(url);
    } catch {}
  }
  return null;
}

export async function initAmcThreeScene({ heroCanvas, ambientCanvas }) {
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const THREE = await loadThreeModule();
  if (!THREE) {
    return createFallbackVisual(heroCanvas, ambientCanvas, prefersReduced);
  }

  let paused = prefersReduced;
  let isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  let spinBoost = 0;
  let tiltAlert = 0;

  // Hero 3D AMC Mail Core: crystal envelope, dual routing rings, and domain satellites.
  let heroRenderer = null;
  let heroScene = null;
  let heroCamera = null;
  let heroGroup = null;
  let envelopeGroup = null;
  let envelopeMat = null;
  let flapMat = null;
  let coreMat = null;
  let ringPrimary = null;
  let ringSecondary = null;
  let ringMat1 = null;
  let ringMat2 = null;
  let satellitesGroup = null;
  let satelliteMeshes = [];
  let rippleMesh = null;
  let rippleMat = null;
  let rippleProgress = 1;

  // Drag and hover pointer state for interactive 3D rotation
  let targetRotY = 0;
  let targetRotX = 0;
  let dragOffsetY = 0;
  let dragOffsetX = 0;
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function buildEnvelopeGeometry() {
    const group = new THREE.Group();

    const bodyShape = new THREE.Shape();
    const bw = 1.48;
    const bh = 0.96;
    const br = 0.14;
    bodyShape.moveTo(-bw / 2 + br, -bh / 2);
    bodyShape.lineTo(bw / 2 - br, -bh / 2);
    bodyShape.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, -bh / 2 + br);
    bodyShape.lineTo(bw / 2, bh / 2 - br);
    bodyShape.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - br, bh / 2);
    bodyShape.lineTo(-bw / 2 + br, bh / 2);
    bodyShape.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, bh / 2 - br);
    bodyShape.lineTo(-bw / 2, -bh / 2 + br);
    bodyShape.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + br, -bh / 2);

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.035,
      bevelSegments: 4,
    });
    bodyGeo.center();

    envelopeMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      metalness: 0.14,
      roughness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      transmission: 0.18,
      transparent: true,
      opacity: 0.95,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, envelopeMat);
    group.add(bodyMesh);

    // Sculpted front triangular flap
    const flapShape = new THREE.Shape();
    flapShape.moveTo(-bw / 2 + 0.07, bh / 2 - 0.03);
    flapShape.lineTo(0, -0.04);
    flapShape.lineTo(bw / 2 - 0.07, bh / 2 - 0.03);
    flapShape.closePath();

    const flapGeo = new THREE.ExtrudeGeometry(flapShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    flapMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      metalness: 0.08,
      roughness: 0.16,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.92,
    });
    const flapMesh = new THREE.Mesh(flapGeo, flapMat);
    flapMesh.position.z = 0.095;
    group.add(flapMesh);

    // Subtle crisp wireframe outline for crystal-glass definition
    const edges = new THREE.EdgesGeometry(bodyGeo, 28);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.48,
    });
    group.add(new THREE.LineSegments(edges, edgeMat));

    // Luminous emblem seal at flap tip (pulses on OTP / bounce / new mail)
    const sealGeo = new THREE.OctahedronGeometry(0.145, 0);
    coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.3,
    });
    const sealMesh = new THREE.Mesh(sealGeo, coreMat);
    sealMesh.position.set(0, -0.02, 0.175);
    group.add(sealMesh);

    return group;
  }

  function rebuildSatellites(count) {
    if (!satellitesGroup) return;
    while (satellitesGroup.children.length > 0) {
      const child = satellitesGroup.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
    satelliteMeshes = [];

    const clamped = Math.max(3, Math.min(10, Number(count) || 6));
    const satGeo = new THREE.IcosahedronGeometry(0.085, 0);
    for (let i = 0; i < clamped; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x38bdf8 : 0x7dd3fc,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.25,
      });
      const mesh = new THREE.Mesh(satGeo, mat);
      const angle = (i / clamped) * Math.PI * 2;
      const radius = i % 2 === 0 ? 1.48 : 1.28;
      mesh.userData = { angle, radius, speed: i % 2 === 0 ? 0.42 : -0.34, tilt: i % 2 === 0 ? 0.38 : -0.45 };
      satellitesGroup.add(mesh);
      satelliteMeshes.push(mesh);
    }
  }

  if (heroCanvas) {
    try {
      heroRenderer = new THREE.WebGLRenderer({
        canvas: heroCanvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      heroRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      heroRenderer.toneMappingExposure = 1.12;

      heroScene = new THREE.Scene();
      heroCamera = new THREE.PerspectiveCamera(36, 280 / 220, 0.1, 50);
      heroCamera.position.set(0, 0.12, 4.45);

      const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0369a1, 1.35);
      heroScene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
      keyLight.position.set(3.2, 4.0, 4.2);
      heroScene.add(keyLight);

      const rimLight = new THREE.PointLight(0x38bdf8, 2.4, 12);
      rimLight.position.set(-2.6, -1.2, 2.4);
      heroScene.add(rimLight);

      heroGroup = new THREE.Group();
      heroScene.add(heroGroup);

      envelopeGroup = buildEnvelopeGeometry();
      heroGroup.add(envelopeGroup);

      // Dual orbital routing rings representing multi-domain Cloudflare Email Routing
      ringMat1 = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.34,
      });
      ringPrimary = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.015, 12, 72), ringMat1);
      ringPrimary.rotation.x = Math.PI / 2.25;
      ringPrimary.rotation.y = 0.25;
      heroGroup.add(ringPrimary);

      ringMat2 = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.36,
      });
      ringSecondary = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.012, 12, 64), ringMat2);
      ringSecondary.rotation.x = -Math.PI / 2.4;
      ringSecondary.rotation.y = -0.35;
      heroGroup.add(ringSecondary);

      // Expanding pulse ring triggered on real mail, OTP, or bounce events
      rippleMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      rippleMesh = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.05, 48), rippleMat);
      heroGroup.add(rippleMesh);

      satellitesGroup = new THREE.Group();
      heroGroup.add(satellitesGroup);
      rebuildSatellites(6);

      const resizeHero = () => {
        const rect = heroCanvas.parentElement?.getBoundingClientRect();
        const w = Math.max(180, Math.round(rect?.width || 280));
        const h = Math.max(160, Math.round(rect?.height || 220));
        heroRenderer.setSize(w, h, false);
        heroCamera.aspect = w / h;
        heroCamera.updateProjectionMatrix();
      };
      resizeHero();
      if (typeof ResizeObserver !== 'undefined' && heroCanvas.parentElement) {
        new ResizeObserver(resizeHero).observe(heroCanvas.parentElement);
      }

      // Pointer drag & hover interactivity on the 3D envelope stage
      heroCanvas.addEventListener('pointerdown', (e) => {
        isDragging = true;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        heroCanvas.setPointerCapture?.(e.pointerId);
      });
      heroCanvas.addEventListener('pointermove', (e) => {
        const rect = heroCanvas.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        targetRotY = nx * 0.42;
        targetRotX = ny * 0.28;
        if (isDragging) {
          dragOffsetY += (e.clientX - lastPointerX) * 0.012;
          dragOffsetX = Math.max(-0.85, Math.min(0.85, dragOffsetX + (e.clientY - lastPointerY) * 0.01));
          lastPointerX = e.clientX;
          lastPointerY = e.clientY;
        }
      });
      const stopDrag = () => { isDragging = false; };
      heroCanvas.addEventListener('pointerup', stopDrag);
      heroCanvas.addEventListener('pointercancel', stopDrag);
      heroCanvas.addEventListener('pointerleave', () => {
        isDragging = false;
        targetRotY = 0;
        targetRotX = 0;
      });
      heroCanvas.setAttribute('data-renderer', 'three');
    } catch {
      heroRenderer = null;
      return createFallbackVisual(heroCanvas, ambientCanvas, prefersReduced);
    }
  }

  // Ambient full-viewport ice-sky crystal nodes behind frosted glass panels.
  let ambRenderer = null;
  let ambScene = null;
  let ambCamera = null;
  let ambParticles = null;
  let ambPointMat = null;
  let ambCrystals = [];
  let mouseParallaxX = 0;
  let mouseParallaxY = 0;

  if (ambientCanvas) {
    try {
      ambRenderer = new THREE.WebGLRenderer({
        canvas: ambientCanvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
      ambRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
      ambScene = new THREE.Scene();
      ambCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 60);
      ambCamera.position.z = 16;

      // Delicate drifting star-ice packets
      const count = 48;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 32;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      ambPointMat = new THREE.PointsMaterial({
        color: 0x38bdf8,
        size: 0.16,
        transparent: true,
        opacity: 0.45,
      });
      ambParticles = new THREE.Points(pGeo, ambPointMat);
      ambScene.add(ambParticles);

      // Subtle wireframe glass prisms floating at screen periphery
      const prismGeo = new THREE.OctahedronGeometry(0.65, 0);
      const prismCoords = [
        [-11, 5.5, -4],
        [11.5, 4.8, -5],
        [-9.5, -5.2, -3],
        [10.2, -5.6, -4],
        [0.8, 7.2, -7],
      ];
      for (let i = 0; i < prismCoords.length; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.16,
        });
        const mesh = new THREE.Mesh(prismGeo, mat);
        mesh.position.set(...prismCoords[i]);
        mesh.scale.setScalar(0.8 + (i % 3) * 0.35);
        mesh.userData = { baseY: prismCoords[i][1], phase: i * 1.4 };
        ambScene.add(mesh);
        ambCrystals.push(mesh);
      }

      const resizeAmb = () => {
        ambRenderer.setSize(window.innerWidth, window.innerHeight, false);
        ambCamera.aspect = window.innerWidth / window.innerHeight;
        ambCamera.updateProjectionMatrix();
      };
      resizeAmb();
      window.addEventListener('resize', resizeAmb, { passive: true });
      window.addEventListener(
        'pointermove',
        (e) => {
          mouseParallaxX = (e.clientX / window.innerWidth - 0.5) * 1.1;
          mouseParallaxY = (e.clientY / window.innerHeight - 0.5) * 0.7;
        },
        { passive: true }
      );
    } catch {
      ambRenderer = null;
    }
  }

  function applyThemeColors(dark) {
    isDark = dark;
    if (envelopeMat) {
      envelopeMat.color.setHex(dark ? 0x38bdf8 : 0x0284c7);
      flapMat.color.setHex(dark ? 0xbae6fd : 0xf0f9ff);
      ringMat1.color.setHex(dark ? 0x38bdf8 : 0x0284c7);
      ringMat1.opacity = dark ? 0.44 : 0.28;
      ringMat2.color.setHex(dark ? 0x7dd3fc : 0x38bdf8);
      ringMat2.opacity = dark ? 0.36 : 0.3;
    }
    if (ambPointMat) {
      ambPointMat.color.setHex(dark ? 0x38bdf8 : 0x0284c7);
      ambPointMat.opacity = dark ? 0.5 : 0.28;
    }
    for (const m of ambCrystals) {
      m.material.color.setHex(dark ? 0x38bdf8 : 0x0ea5e9);
      m.material.opacity = dark ? 0.2 : 0.14;
    }
  }

  applyThemeColors(isDark);

  let rafId = null;
  let elapsed = 0;
  let lastTs = performance.now();

  function renderFrame(ts, singleStep = false) {
    const dt = singleStep ? 0 : Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (!paused) {
      elapsed += dt;
    }

    if (heroRenderer && heroGroup && envelopeGroup) {
      if (spinBoost > 0.005) {
        dragOffsetY += spinBoost * dt * 6.5;
        spinBoost *= Math.pow(0.08, dt);
      }
      if (Math.abs(tiltAlert) > 0.002) {
        tiltAlert *= Math.pow(0.12, dt);
      }

      const floatY = paused ? 0 : Math.sin(elapsed * 1.65) * 0.08;
      envelopeGroup.position.y = floatY;

      const desiredY = targetRotY + dragOffsetY + (paused ? 0.28 : Math.sin(elapsed * 0.55) * 0.18);
      const desiredX = targetRotX + dragOffsetX + tiltAlert + (paused ? -0.1 : Math.cos(elapsed * 0.45) * 0.06);
      envelopeGroup.rotation.y += (desiredY - envelopeGroup.rotation.y) * (singleStep ? 1 : 0.1);
      envelopeGroup.rotation.x += (desiredX - envelopeGroup.rotation.x) * (singleStep ? 1 : 0.1);

      ringPrimary.rotation.z = elapsed * 0.22;
      ringSecondary.rotation.z = -elapsed * 0.17;

      for (const sat of satelliteMeshes) {
        const d = sat.userData;
        const a = d.angle + elapsed * d.speed;
        sat.position.set(
          Math.cos(a) * d.radius,
          Math.sin(a) * d.radius * Math.sin(d.tilt),
          Math.sin(a) * d.radius * Math.cos(d.tilt)
        );
        sat.rotation.x = elapsed * 0.9;
        sat.rotation.y = elapsed * 1.1;
      }

      if (rippleProgress < 1) {
        rippleProgress = Math.min(1, rippleProgress + dt * 1.45);
        const scale = 0.75 + rippleProgress * 1.35;
        rippleMesh.scale.setScalar(scale);
        rippleMat.opacity = (1 - rippleProgress) * 0.65;
      } else {
        rippleMat.opacity = 0;
      }

      heroRenderer.render(heroScene, heroCamera);
    }

    if (ambRenderer && ambScene && ambCamera) {
      if (ambParticles) {
        ambParticles.rotation.y = elapsed * 0.025 + mouseParallaxX * 0.08;
        ambParticles.rotation.x = mouseParallaxY * 0.06;
      }
      for (const c of ambCrystals) {
        c.rotation.x = elapsed * 0.14 + c.userData.phase;
        c.rotation.y = elapsed * 0.18 + c.userData.phase;
        c.position.y = c.userData.baseY + Math.sin(elapsed * 0.5 + c.userData.phase) * 0.35;
      }
      ambCamera.position.x += (mouseParallaxX - ambCamera.position.x) * 0.04;
      ambCamera.position.y += (-mouseParallaxY - ambCamera.position.y) * 0.04;
      ambCamera.lookAt(0, 0, 0);
      ambRenderer.render(ambScene, ambCamera);
    }

    if (!paused && !singleStep && document.visibilityState === 'visible') {
      rafId = requestAnimationFrame((nextTs) => renderFrame(nextTs, false));
    } else {
      rafId = null;
    }
  }

  function startLoop() {
    if (paused || rafId !== null || document.visibilityState !== 'visible') return;
    lastTs = performance.now();
    rafId = requestAnimationFrame((ts) => renderFrame(ts, false));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startLoop();
    } else if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  // Always paint an initial crisp frame even when paused or reduced-motion is enabled.
  renderFrame(performance.now(), true);
  if (!paused) startLoop();

  return {
    pulse(kind = 'inbox') {
      if (!rippleMat || !coreMat) return;
      const palette = {
        generate: { ripple: 0x38bdf8, emissive: 0x0ea5e9 },
        inbox: { ripple: 0x0ea5e9, emissive: 0x0284c7 },
        otp: { ripple: 0x10b981, emissive: 0x059669 },
        bounce: { ripple: 0xef4444, emissive: 0xdc2626 },
      };
      const picked = palette[kind] || palette.inbox;
      rippleMat.color.setHex(picked.ripple);
      coreMat.emissive.setHex(picked.emissive);
      rippleProgress = 0;

      if (kind === 'generate') spinBoost = 1.45;
      if (kind === 'bounce') tiltAlert = 0.28;

      if (paused) {
        renderFrame(performance.now(), true);
      }
    },
    setTheme(theme) {
      applyThemeColors(theme === 'dark');
      if (paused) renderFrame(performance.now(), true);
    },
    setDomainCount(count) {
      rebuildSatellites(count);
      if (paused) renderFrame(performance.now(), true);
    },
    setPaused(nextPaused) {
      paused = Boolean(nextPaused);
      if (paused) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        renderFrame(performance.now(), true);
      } else {
        startLoop();
      }
    },
    isPaused() {
      return paused;
    },
  };
}
