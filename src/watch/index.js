import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { createMaterials } from "./materials.js";
import { createCase } from "./case.js";
import { createDial } from "./dial.js";
import { createHands } from "./hands.js";
import { createStrap } from "./strap.js";
import { TAU } from "./utils.js";

const FONT_URL = "/fonts/helvetiker_bold.typeface.json";

/* Leather is coloured by tinting a neutral-grained hide. Keeping these tints
   close to the final leather colours means the grain survives the multiply. */
const LEATHER_OPTIONS = {
  Walnut: {
    tint: "#7c5137",
    sheen: "#a87856",
    thread: "#c7a482",
    emblem: "#ffffff",
  },
  Saddle: {
    tint: "#a8734c",
    sheen: "#c3956c",
    thread: "#d6b794",
    emblem: "#ffffff",
  },
  Espresso: {
    tint: "#4f372a",
    sheen: "#72533e",
    thread: "#aa8a6d",
    emblem: "#d7bda4",
  },
  Black: {
    tint: "#302d2a",
    sheen: "#4f4a44",
    thread: "#958d82",
    emblem: "#c9b49e",
  },
};

function loadFont() {
  return new Promise((resolve, reject) => {
    new FontLoader().load(FONT_URL, resolve, undefined, () => {
      reject(new Error("Unable to load the dial numeral typeface."));
    });
  });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/* ————————————————————————————————————————————————————————————————
   The watch is a single assembly. Every component shares the same local
   coordinate system: +Y toward 12 o'clock, +X toward 3 o'clock, +Z toward
   the wearer (and the camera).
———————————————————————————————————————————————————————————————— */
export async function createWatch(renderer, { onProgress = () => {} } = {}) {
  onProgress("Milling the case", 0.08);
  await nextFrame();

  const materials = createMaterials(renderer);

  onProgress("Inking the dial", 0.4);
  await nextFrame();

  const font = await loadFont();

  onProgress("Assembling the movement", 0.66);
  await nextFrame();

  const watchCase = createCase(materials);
  const dial = createDial(font, materials);
  const hands = createHands(materials);
  const strap = createStrap(materials);

  const root = new THREE.Group();
  root.name = "Timex Expedition Metal Field";
  root.add(watchCase, dial, hands.group, strap.group);

  /* ————— Time ————— */
  let totalSeconds = 10 * 3600 + 9 * 60 + 36;
  let sweep = true;

  const getSecondsForDisplay = () => (sweep ? totalSeconds : Math.floor(totalSeconds));

  const applyHands = () => {
    const seconds = getSecondsForDisplay() % 60;
    const minutes = (totalSeconds / 60) % 60;
    const hours = (totalSeconds / 3600) % 12;
    hands.second.rotation.z = -(seconds / 60) * TAU;
    hands.minute.rotation.z = -(minutes / 60) * TAU;
    hands.hour.rotation.z = -(hours / 12) * TAU;
  };

  applyHands();

  /* ————— Leather colour transitions ————— */
  const initial = LEATHER_OPTIONS.Walnut;
  const targets = {
    leather: new THREE.Color(initial.tint),
    sheen: new THREE.Color(initial.sheen),
    thread: new THREE.Color(initial.thread),
    emblem: new THREE.Color(initial.emblem),
  };
  materials.leather.color.copy(targets.leather);
  materials.leather.sheenColor.copy(targets.sheen);
  materials.thread.color.copy(targets.thread);
  materials.emblem.color.copy(targets.emblem);
  let strapName = "Walnut";

  const setStrapColor = (name) => {
    const option = LEATHER_OPTIONS[name] || LEATHER_OPTIONS.Walnut;
    strapName = LEATHER_OPTIONS[name] ? name : "Walnut";
    targets.leather.set(option.tint);
    targets.sheen.set(option.sheen);
    targets.thread.set(option.thread);
    targets.emblem.set(option.emblem);
  };

  /* ————— Public controls ————— */
  const setTime = (hours, minutes, seconds = 0) => {
    const h = ((hours % 24) + 24) % 24;
    const m = ((minutes % 60) + 60) % 60;
    const s = ((seconds % 60) + 60) % 60;
    totalSeconds = (h % 12) * 3600 + m * 60 + s;
    applyHands();
  };

  const setSecondsSweep = (enabled) => {
    sweep = Boolean(enabled);
    applyHands();
  };

  const getTime = () => {
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600) % 12 || 12;
    return { hours, minutes, seconds };
  };

  const setCrystalVisible = (visible) => {
    dial.userData.crystal.visible = Boolean(visible);
    dial.userData.glare.visible = Boolean(visible);
  };

  const update = (delta) => {
    totalSeconds = (totalSeconds + delta) % 43200;
    applyHands();

    const blend = 1 - Math.exp(-5.5 * Math.min(delta, 0.1));
    materials.leather.color.lerp(targets.leather, blend);
    materials.leather.sheenColor.lerp(targets.sheen, blend);
    materials.thread.color.lerp(targets.thread, blend);
    materials.emblem.color.lerp(targets.emblem, blend);
  };

  const dispose = () => {
    root.traverse((child) => {
      if (child.isMesh || child.isLineLoop) {
        child.geometry?.dispose();
      }
    });
    Object.values(materials).forEach((material) => {
      if (material && material.isMaterial) material.dispose();
    });
  };

  return {
    root,
    materials,
    case: watchCase,
    dial,
    hands,
    strap,
    setTime,
    getTime,
    setSecondsSweep,
    setCrystalVisible,
    setStrapColor,
    getStrapName: () => strapName,
    update,
    dispose,
  };
}
