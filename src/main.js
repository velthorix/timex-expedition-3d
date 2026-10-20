import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWatch } from "./watch/index.js";
import { createStudioEnvironment, disposeEnvironment } from "./environment.js";

const TAU = Math.PI * 2;
const DEFAULT_FOV = 28;

const LIGHT_PRESETS = {
  studio: {
    label: "Studio",
    theme: "studio",
    exposure: 0.9,
    environment: 0.98,
    hemisphere: 0.3,
    key: 2.1,
    keyColor: "#fff0dc",
    fill: 0.55,
    fillColor: "#d9e5f4",
    rim: 1.45,
    rimColor: "#ffd7b1",
    back: 0.55,
    backColor: "#e8efff",
    ground: "#2c2117",
    shadow: 0.12,
  },
  daylight: {
    label: "Daylight",
    theme: "daylight",
    exposure: 0.98,
    environment: 1.12,
    hemisphere: 0.72,
    key: 3.0,
    keyColor: "#ffffff",
    fill: 1.15,
    fillColor: "#cae4ff",
    rim: 1.25,
    rimColor: "#ffffff",
    back: 1.35,
    backColor: "#eef6ff",
    ground: "#1e2425",
    shadow: 0.12,
  },
  noir: {
    label: "Noir",
    theme: "noir",
    exposure: 0.9,
    environment: 0.62,
    hemisphere: 0.22,
    key: 3.5,
    keyColor: "#f3e2cc",
    fill: 0.3,
    fillColor: "#7187ad",
    rim: 2.7,
    rimColor: "#dbe5f5",
    back: 0.85,
    backColor: "#bccff0",
    ground: "#050403",
    shadow: 0.28,
  },
};

const VIEWS = {
  front: { radius: 19.9, phi: 1.505, theta: 0.085 },
  "three-quarter": { radius: 19.9, phi: 1.35, theta: 0.54 },
  back: { radius: 19.9, phi: 1.525, theta: Math.PI },
};

const canvas = document.querySelector("#watch-canvas");
const app = document.querySelector("#app");
const intro = document.querySelector("#intro");
const introStatus = document.querySelector("#intro-status");
const toast = document.querySelector("#toast");
const dialTime = document.querySelector("#dial-time");
const watchTimeLive = document.querySelector("#watch-time-live");
const customizer = document.querySelector("#customizer");
const customizerButton = document.querySelector("#open-customizer");
const customizerClose = document.querySelector("#close-customizer");
const infoPanel = document.querySelector("#info-panel");
const infoButton = document.querySelector("#info-button");
const infoButtonMobile = document.querySelector("#info-button-mobile");
const infoClose = document.querySelector("#close-info");
const infoReturn = document.querySelector("[data-close-info]");
const scrim = document.querySelector("#panel-scrim");
const railButtons = [...document.querySelectorAll(".rail-btn")];
const hourInput = document.querySelector("#hour-input");
const minuteInput = document.querySelector("#minute-input");
const hourOutput = document.querySelector("#hour-output");
const minuteOutput = document.querySelector("#minute-output");
const liveTimeButton = document.querySelector("#set-live-time");
const secondsToggle = document.querySelector("#seconds-toggle");
const strapNameLabel = document.querySelector("#strap-name");
const lightNameLabel = document.querySelector("#light-name");
const swatches = [...document.querySelectorAll(".swatch")];
const lightingButtons = [...document.querySelectorAll(".segment__btn")];
const rotateButton = document.querySelector("#toggle-rotate");
const crystalButton = document.querySelector("#toggle-crystal");
const resetButton = document.querySelector("#reset-camera");

const pad = (value) => String(value).padStart(2, "0");

let toastTimer = 0;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2100);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function boot() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LIGHT_PRESETS.studio.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    DEFAULT_FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  const target = new THREE.Vector3(0, 0, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentScene = createStudioEnvironment();
  const environmentTarget = pmrem.fromScene(environmentScene, 0.025, 0.1, 100);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = LIGHT_PRESETS.studio.environment;
  pmrem.dispose();
  disposeEnvironment(environmentScene);

  /* ————— Lights ————— */
  const hemisphere = new THREE.HemisphereLight(0xfff7ec, 0x50473b, 0.58);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xfff0dc, 2.9);
  keyLight.position.set(-5.5, 7.8, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 40;
  keyLight.shadow.camera.left = -6.5;
  keyLight.shadow.camera.right = 6.5;
  keyLight.shadow.camera.top = 9.5;
  keyLight.shadow.camera.bottom = -9.5;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.normalBias = 0.025;
  keyLight.shadow.radius = 18;
  keyLight.shadow.blurSamples = 24;
  keyLight.target.position.copy(target);
  scene.add(keyLight, keyLight.target);

  const fillLight = new THREE.DirectionalLight(0xd9e5f4, 0.8);
  fillLight.position.set(8, -2.5, 7);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffd7b1, 2.1);
  rimLight.position.set(4.5, 5.2, -9);
  scene.add(rimLight);

  const backLight = new THREE.DirectionalLight(0xe8efff, 1.4);
  backLight.position.set(1.5, -1.5, -11);
  scene.add(backLight);

  /* ————— Soft studio shadow behind the piece ————— */
  const shadowMaterial = new THREE.ShadowMaterial({
    color: new THREE.Color(LIGHT_PRESETS.studio.ground),
    opacity: LIGHT_PRESETS.studio.shadow,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), shadowMaterial);
  shadowPlane.position.z = -1.08;
  shadowPlane.receiveShadow = true;
  shadowPlane.renderOrder = -1;
  scene.add(shadowPlane);

  /* ————— Camera controls ————— */
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI - 0.3;
  controls.autoRotateSpeed = 0.75;

  const initialSpherical = new THREE.Spherical(24.8, 1.5, 0.03);
  camera.position.setFromSpherical(initialSpherical).add(target);
  camera.lookAt(target);
  controls.update();

  let cameraTween = null;
  let activeView = "front";
  let autoRotate = false;
  let customizerOpen = false;
  let liveTime = false;
  let lastLiveMinute = -1;
  let manualHour = 10;
  let manualMinute = 9;
  let watch = null;

  const currentSpherical = () =>
    new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));

  const compactLayout = () => window.innerWidth < 821;
  const dockedCustomizer = () => window.innerWidth <= 1180;
  // The upper strap now carries a finished free end of its own. Leave a little
  // more breathing room above it than the original flat-cut strap needed.
  const desktopHeightFit = () =>
    THREE.MathUtils.clamp(1000 / window.innerHeight, 1.09, 1.15);
  const radiusForView = (name) =>
    VIEWS[name].radius *
    (compactLayout()
      ? customizerOpen
        ? 1.4
        : 1.125
      : desktopHeightFit() * (customizerOpen ? 1.08 : 1));

  const goToView = (name, { duration = 1.35, silent = false } = {}) => {
    const definition = VIEWS[name];
    if (!definition) return;

    if (autoRotate) setAutoRotate(false, true);

    const from = currentSpherical();
    const to = new THREE.Spherical(radiusForView(name), definition.phi, definition.theta);
    let difference = to.theta - from.theta;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));
    to.theta = from.theta + difference;

    cameraTween = {
      from,
      to,
      elapsed: 0,
      duration: Math.max(0.01, duration),
    };
    controls.enabled = false;
    activeView = name;
    railButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === name);
    });
    if (!silent) {
      // The reset affordance gets its own copy in the caller.
    }
  };

  const setAutoRotate = (enabled, quiet = false) => {
    autoRotate = enabled;
    controls.autoRotate = enabled;
    rotateButton.setAttribute("aria-pressed", String(enabled));
    if (!quiet) showToast(enabled ? "Auto-rotate on" : "Auto-rotate off");
  };

  const setViewOffset = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;

    if (width >= 821) {
      // The dock sits low and the hero copy occupies the left edge. Shift the
      // watch toward the open space. When the customizer is open on a narrow
      // desktop it becomes a right-hand drawer, so the watch slides left and
      // stays fully visible beside it.
      const shift = customizerOpen
        ? Math.min(190, width * 0.18)
        : -Math.min(84, width * 0.042);
      const lift = Math.round(height * 0.03);
      camera.setViewOffset(width, height, shift, lift, width, height);
    } else {
      // On phones the bottom sheet of controls eats into the stage, so lift
      // the watch slightly and leave breathing room above the dock. When the
      // customizer is open, lift it clear of the sheet for a live preview.
      const lift = Math.round(height * (customizerOpen ? 0.25 : 0.04));
      camera.setViewOffset(width, height, 0, lift, width, height);
    }
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (customizer.classList.contains("is-open")) {
      customizerOpen = dockedCustomizer();
    }
    setViewOffset();

    // Keep a preset view fully in frame when the window changes orientation.
    if (activeView && !cameraTween) {
      const spherical = currentSpherical();
      const fitted = radiusForView(activeView);
      if (Math.abs(spherical.radius - fitted) > 0.04) {
        spherical.radius = fitted;
        camera.position.setFromSpherical(spherical).add(controls.target);
        camera.lookAt(controls.target);
        controls.update();
      }
    }
  };
  window.addEventListener("resize", resize);
  setViewOffset();

  /* ————— Build the watch ————— */
  try {
    watch = await createWatch(renderer, {
      onProgress: (label) => {
        if (introStatus) introStatus.textContent = label;
      },
    });
  } catch (error) {
    console.error(error);
    if (introStatus) introStatus.textContent = "The movement could not be assembled.";
    return;
  }

  if (introStatus) introStatus.textContent = "Polishing the crystal";
  scene.add(watch.root);
  setDialDisplay(manualHour, manualMinute);

  const clock = { last: performance.now() };
  let elapsed = 0;

  function setDialDisplay(hours, minutes) {
    dialTime.textContent = `${pad(hours)}:${pad(minutes)}`;
  }

  function updateLiveInterface() {
    liveTimeButton.setAttribute("aria-pressed", String(liveTime));
    liveTimeButton.textContent = liveTime ? "Following local time" : "Use live time";
    watchTimeLive.classList.toggle("is-paused", !liveTime);
    watchTimeLive.innerHTML = liveTime ? "<i></i>Live" : "<i></i>Running";
  }

  function syncTimeFromInputs() {
    const hours = Number(hourInput.value);
    const minutes = Number(minuteInput.value);
    hourOutput.textContent = pad(hours);
    minuteOutput.textContent = pad(minutes);
    const current = watch.getTime();
    watch.setTime(hours, minutes, current.seconds);
    manualHour = hours;
    manualMinute = minutes;
    setDialDisplay(hours, minutes);
    if (liveTime) {
      liveTime = false;
      lastLiveMinute = -1;
      updateLiveInterface();
    }
  }

  /* ————— UI: panels ————— */
  let openPanel = null;

  function revealScrim(visible) {
    if (visible) {
      scrim.hidden = false;
      requestAnimationFrame(() => scrim.classList.add("is-visible"));
    } else {
      scrim.classList.remove("is-visible");
      window.setTimeout(() => {
        if (!scrim.classList.contains("is-visible")) scrim.hidden = true;
      }, 320);
    }
  }

  function closeCustomizer({ restoreFocus = true } = {}) {
    const wasPreview = customizerOpen;
    customizerOpen = false;
    document.body.classList.remove("customizer-open");
    customizer.classList.remove("is-open");
    customizer.setAttribute("aria-hidden", "true");
    customizerButton.setAttribute("aria-expanded", "false");
    if (wasPreview) {
      setViewOffset();
      goToView("front", { duration: 0.55, silent: true });
    }
    if (openPanel === "customizer") {
      openPanel = null;
      revealScrim(false);
    }
    if (restoreFocus) customizerButton.focus({ preventScroll: true });
  }

  function openCustomizer() {
    if (openPanel === "info") closeInfo({ restoreFocus: false });
    openPanel = "customizer";
    customizerOpen = dockedCustomizer();
    document.body.classList.add("customizer-open");
    customizer.classList.add("is-open");
    customizer.setAttribute("aria-hidden", "false");
    customizerButton.setAttribute("aria-expanded", "true");
    if (customizerOpen) {
      setViewOffset();
      goToView("front", { duration: 0.55, silent: true });
    }
    revealScrim(true);
    customizerClose.focus({ preventScroll: true });
  }

  function closeInfo({ restoreFocus = true } = {}) {
    infoPanel.classList.remove("is-open");
    infoPanel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("info-open");
    if (openPanel === "info") {
      openPanel = null;
      revealScrim(false);
    }
    if (restoreFocus) {
      const returnTarget =
        infoButtonMobile && infoButtonMobile.offsetParent ? infoButtonMobile : infoButton;
      returnTarget.focus({ preventScroll: true });
    }
  }

  function openInfo() {
    if (openPanel === "customizer") closeCustomizer({ restoreFocus: false });
    openPanel = "info";
    infoPanel.classList.add("is-open");
    infoPanel.setAttribute("aria-hidden", "false");
    document.body.classList.add("info-open");
    revealScrim(true);
    infoClose.focus({ preventScroll: true });
  }

  customizerButton.addEventListener("click", () => {
    if (customizer.classList.contains("is-open")) closeCustomizer();
    else openCustomizer();
  });
  customizerClose.addEventListener("click", () => closeCustomizer());
  infoButton.addEventListener("click", openInfo);
  infoButtonMobile?.addEventListener("click", openInfo);
  infoClose.addEventListener("click", () => closeInfo());
  infoReturn.addEventListener("click", () => closeInfo());
  scrim.addEventListener("click", () => {
    if (openPanel === "customizer") closeCustomizer();
    else if (openPanel === "info") closeInfo();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openPanel) {
      if (openPanel === "customizer") closeCustomizer();
      else closeInfo();
    }
  });

  /* ————— UI: camera ————— */
  railButtons.forEach((button) => {
    button.addEventListener("click", () => {
      goToView(button.dataset.view);
    });
  });

  resetButton.addEventListener("click", () => {
    goToView("front", { duration: 1.1 });
    showToast("Camera reset");
  });

  rotateButton.addEventListener("click", () => setAutoRotate(!autoRotate));

  canvas.addEventListener("dblclick", () => {
    goToView("front", { duration: 1 });
  });

  controls.addEventListener("start", () => {
    canvas.classList.add("is-dragging");
    if (!cameraTween) {
      railButtons.forEach((button) => button.classList.remove("is-active"));
      activeView = null;
    }
  });
  controls.addEventListener("end", () => canvas.classList.remove("is-dragging"));

  /* ————— UI: crystal ————— */
  let crystalVisible = true;
  crystalButton.addEventListener("click", () => {
    crystalVisible = !crystalVisible;
    watch.setCrystalVisible(crystalVisible);
    crystalButton.setAttribute("aria-pressed", String(crystalVisible));
    showToast(crystalVisible ? "Crystal restored" : "Crystal removed");
  });

  /* ————— UI: leather ————— */
  swatches.forEach((swatch) => {
    swatch.addEventListener("click", () => {
      const name = swatch.dataset.strap;
      watch.setStrapColor(name);
      strapNameLabel.textContent = name;
      swatches.forEach((item) => {
        const selected = item === swatch;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      showToast(`${name} leather`);
    });
  });

  /* ————— UI: lighting ————— */
  const lightingState = {
    exposure: LIGHT_PRESETS.studio.exposure,
    environment: LIGHT_PRESETS.studio.environment,
    hemisphere: LIGHT_PRESETS.studio.hemisphere,
    key: LIGHT_PRESETS.studio.key,
    fill: LIGHT_PRESETS.studio.fill,
    rim: LIGHT_PRESETS.studio.rim,
    back: LIGHT_PRESETS.studio.back,
    shadow: LIGHT_PRESETS.studio.shadow,
    keyColor: new THREE.Color(LIGHT_PRESETS.studio.keyColor),
    fillColor: new THREE.Color(LIGHT_PRESETS.studio.fillColor),
    rimColor: new THREE.Color(LIGHT_PRESETS.studio.rimColor),
    backColor: new THREE.Color(LIGHT_PRESETS.studio.backColor),
    groundColor: new THREE.Color(LIGHT_PRESETS.studio.ground),
  };

  function applyLighting(name) {
    const preset = LIGHT_PRESETS[name] || LIGHT_PRESETS.studio;
    document.body.dataset.theme = preset.theme;
    lightNameLabel.textContent = preset.label;
    lightingButtons.forEach((button) => {
      const active = button.dataset.light === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    lightingState.exposure = preset.exposure;
    lightingState.environment = preset.environment;
    lightingState.hemisphere = preset.hemisphere;
    lightingState.key = preset.key;
    lightingState.fill = preset.fill;
    lightingState.rim = preset.rim;
    lightingState.back = preset.back;
    lightingState.shadow = preset.shadow;
    lightingState.keyColor.set(preset.keyColor);
    lightingState.fillColor.set(preset.fillColor);
    lightingState.rimColor.set(preset.rimColor);
    lightingState.backColor.set(preset.backColor);
    lightingState.groundColor.set(preset.ground);
  }

  lightingButtons.forEach((button) => {
    button.addEventListener("click", () => applyLighting(button.dataset.light));
  });

  /* ————— UI: time ————— */
  liveTimeButton.addEventListener("click", () => {
    liveTime = !liveTime;
    if (liveTime) {
      const now = new Date();
      hourInput.value = now.getHours();
      minuteInput.value = now.getMinutes();
      hourOutput.textContent = pad(now.getHours());
      minuteOutput.textContent = pad(now.getMinutes());
      manualHour = now.getHours();
      manualMinute = now.getMinutes();
      setDialDisplay(manualHour, manualMinute);
      lastLiveMinute = -1;
      showToast("Following local time");
    } else {
      const now = new Date();
      hourInput.value = now.getHours();
      minuteInput.value = now.getMinutes();
      hourOutput.textContent = pad(now.getHours());
      minuteOutput.textContent = pad(now.getMinutes());
      manualHour = now.getHours();
      manualMinute = now.getMinutes();
      setDialDisplay(manualHour, manualMinute);
      lastLiveMinute = -1;
      showToast("Time held");
    }
    updateLiveInterface();
  });

  hourInput.addEventListener("input", syncTimeFromInputs);
  minuteInput.addEventListener("input", syncTimeFromInputs);

  secondsToggle.addEventListener("change", () => {
    watch.setSecondsSweep(secondsToggle.checked);
  });

  /* ————— Initial state ————— */
  updateLiveInterface();
  applyLighting("studio");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  goToView("front", { duration: reduceMotion ? 0.01 : 1.9, silent: true });

  // Exposed for visual QA and debugging in development.

  app.classList.add("is-ready");
  window.setTimeout(() => {
    intro.setAttribute("aria-hidden", "true");
    intro.style.display = "none";
  }, 1600);

  /* ————— Render loop ————— */
  function animate() {
    const now = performance.now();
    const delta = Math.min(Math.max(0, (now - clock.last) / 1000), 0.06);
    clock.last = now;
    elapsed += delta;

    if (liveTime) {
      const now = new Date();
      const minute = now.getMinutes();
      watch.setTime(
        now.getHours(),
        minute,
        now.getSeconds() + now.getMilliseconds() / 1000
      );
      if (minute !== lastLiveMinute) {
        lastLiveMinute = minute;
        hourInput.value = now.getHours();
        minuteInput.value = minute;
        hourOutput.textContent = pad(now.getHours());
        minuteOutput.textContent = pad(minute);
        manualHour = now.getHours();
        manualMinute = minute;
        setDialDisplay(manualHour, manualMinute);
      }
    } else {
      watch.update(delta);
    }

    if (cameraTween) {
      cameraTween.elapsed += delta;
      const progress = Math.min(1, cameraTween.elapsed / cameraTween.duration);
      const eased = easeInOutCubic(progress);
      const spherical = new THREE.Spherical(
        THREE.MathUtils.lerp(cameraTween.from.radius, cameraTween.to.radius, eased),
        THREE.MathUtils.lerp(cameraTween.from.phi, cameraTween.to.phi, eased),
        THREE.MathUtils.lerp(cameraTween.from.theta, cameraTween.to.theta, eased)
      );
      camera.position.setFromSpherical(spherical).add(controls.target);
      camera.lookAt(controls.target);
      if (progress >= 1) {
        cameraTween = null;
        controls.enabled = true;
        controls.update();
      }
    } else {
      controls.update(delta);
    }

    const blend = 1 - Math.exp(-4.5 * delta);
    renderer.toneMappingExposure = THREE.MathUtils.damp(
      renderer.toneMappingExposure,
      lightingState.exposure,
      4.5,
      delta
    );
    scene.environmentIntensity = THREE.MathUtils.damp(
      scene.environmentIntensity,
      lightingState.environment,
      4.5,
      delta
    );
    hemisphere.intensity = THREE.MathUtils.damp(
      hemisphere.intensity,
      lightingState.hemisphere,
      4.5,
      delta
    );
    keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, lightingState.key, 4.5, delta);
    fillLight.intensity = THREE.MathUtils.damp(fillLight.intensity, lightingState.fill, 4.5, delta);
    rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, lightingState.rim, 4.5, delta);
    backLight.intensity = THREE.MathUtils.damp(backLight.intensity, lightingState.back, 4.5, delta);
    keyLight.color.lerp(lightingState.keyColor, blend);
    fillLight.color.lerp(lightingState.fillColor, blend);
    rimLight.color.lerp(lightingState.rimColor, blend);
    backLight.color.lerp(lightingState.backColor, blend);
    shadowMaterial.color.lerp(lightingState.groundColor, blend);
    shadowMaterial.opacity = THREE.MathUtils.damp(
      shadowMaterial.opacity,
      lightingState.shadow,
      4.5,
      delta
    );

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);
}

boot().catch((error) => {
  console.error(error);
  if (introStatus) introStatus.textContent = "This study needs WebGL to run.";
});
