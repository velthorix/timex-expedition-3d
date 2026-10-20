import * as THREE from "three";
import {
  createCasebackMetalMaps,
  createCasebackTexture,
  createDateTexture,
  createDialBumpTexture,
  createDialTexture,
  createEmblemTexture,
  createLeatherTextures,
  createMetalMaps,
} from "../textures.js";

/* The palette is intentionally quiet. Metals pick up their life from the
   studio environment; painted surfaces stay matte and tactile. */
export function createMaterials(renderer) {
  const leatherTextures = createLeatherTextures(renderer);
  const dialTexture = createDialTexture(renderer);
  const dialBump = createDialBumpTexture(renderer);
  const dateTexture = createDateTexture(renderer);
  const casebackTexture = createCasebackTexture(renderer);
  const emblemTexture = createEmblemTexture(renderer, { color: "#2d1c12" });
  const bezelMetal = createMetalMaps(renderer, { radial: true });
  const caseMetal = createMetalMaps(renderer, { radial: false });
  const casebackMetal = createCasebackMetalMaps(renderer);

  const brushedSteel = new THREE.MeshPhysicalMaterial({
    name: "Brushed stainless steel",
    color: new THREE.Color("#aaa8a1"),
    metalness: 1,
    roughness: 0.8,
    roughnessMap: caseMetal.roughness,
    bumpMap: caseMetal.bump,
    bumpScale: 0.0026,
    envMapIntensity: 0.92,
    clearcoat: 0.02,
    clearcoatRoughness: 0.42,
  });

  const brushedBezel = new THREE.MeshPhysicalMaterial({
    name: "Radially brushed bezel",
    color: new THREE.Color("#aaa79f"),
    metalness: 1,
    roughness: 0.95,
    roughnessMap: bezelMetal.roughness,
    bumpMap: bezelMetal.bump,
    bumpScale: 0.0026,
    envMapIntensity: 0.78,
    clearcoat: 0.02,
    clearcoatRoughness: 0.38,
  });

  const polishedSteel = new THREE.MeshPhysicalMaterial({
    name: "Polished stainless steel",
    color: new THREE.Color("#c9c6be"),
    metalness: 1,
    roughness: 0.12,
    envMapIntensity: 1.02,
    clearcoat: 0.12,
    clearcoatRoughness: 0.1,
  });

  const casebackSteel = new THREE.MeshPhysicalMaterial({
    name: "Circular-brushed case back",
    color: new THREE.Color("#928f88"),
    metalness: 1,
    roughness: 0.94,
    roughnessMap: casebackMetal.map,
    bumpMap: casebackMetal.map,
    bumpScale: 0.007,
    envMapIntensity: 0.62,
  });

  const hardwareSteel = new THREE.MeshPhysicalMaterial({
    name: "Buckle steel",
    color: new THREE.Color("#cfccc4"),
    metalness: 1,
    roughness: 0.28,
    envMapIntensity: 1.05,
    clearcoat: 0.05,
    clearcoatRoughness: 0.18,
  });

  const handsSteel = new THREE.MeshPhysicalMaterial({
    name: "Hand steel",
    color: new THREE.Color("#9c988e"),
    metalness: 0.96,
    roughness: 0.26,
    envMapIntensity: 0.72,
    clearcoat: 0.08,
    clearcoatRoughness: 0.14,
  });

  const lugSteel = new THREE.MeshPhysicalMaterial({
    name: "Satin lug steel",
    color: new THREE.Color("#a8a49c"),
    metalness: 0.5,
    roughness: 0.95,
    roughnessMap: caseMetal.roughness,
    bumpMap: caseMetal.bump,
    bumpScale: 0.003,
    envMapIntensity: 0.5,
  });

  const numeralSteel = new THREE.MeshPhysicalMaterial({
    name: "Raised numeral steel",
    color: new THREE.Color("#beb8ac"),
    metalness: 0.6,
    roughness: 0.4,
    envMapIntensity: 0.7,
    clearcoat: 0.05,
    clearcoatRoughness: 0.24,
  });

  const darkSteel = new THREE.MeshPhysicalMaterial({
    name: "Dark inner steel",
    color: new THREE.Color("#716e67"),
    metalness: 0.92,
    roughness: 0.34,
    envMapIntensity: 0.55,
  });

  const blackSteel = new THREE.MeshStandardMaterial({
    name: "Recess shadow",
    color: new THREE.Color("#171614"),
    metalness: 0.55,
    roughness: 0.54,
  });

  const dial = new THREE.MeshPhysicalMaterial({
    name: "Ivory dial",
    map: dialTexture,
    color: new THREE.Color("#fffdf6"),
    metalness: 0,
    roughness: 0.62,
    bumpMap: dialBump,
    bumpScale: 0.0012,
    clearcoat: 0.08,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.1,
  });

  const date = new THREE.MeshStandardMaterial({
    name: "Date disc",
    map: dateTexture,
    roughness: 0.56,
    metalness: 0,
    envMapIntensity: 0.15,
  });

  const dialText = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#191713"),
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  const lume = new THREE.MeshPhysicalMaterial({
    name: "Ivory lume",
    color: new THREE.Color("#e2dbb6"),
    roughness: 0.52,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.36,
    envMapIntensity: 0.22,
    emissive: new THREE.Color("#cfc596"),
    emissiveIntensity: 0.035,
  });

  const lumeRim = new THREE.MeshPhysicalMaterial({
    name: "Lume eyelet",
    color: new THREE.Color("#85827a"),
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 0.7,
  });

  const secondsRed = new THREE.MeshPhysicalMaterial({
    name: "Seconds hand red",
    color: new THREE.Color("#ad1f19"),
    metalness: 0.12,
    roughness: 0.17,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    envMapIntensity: 0.85,
  });

  const handOutline = new THREE.MeshStandardMaterial({
    name: "Hand keyline",
    color: new THREE.Color("#3a3731"),
    roughness: 0.68,
    metalness: 0.28,
    envMapIntensity: 0.25,
  });

  const leather = new THREE.MeshPhysicalMaterial({
    name: "Full-grain leather",
    map: leatherTextures.map,
    normalMap: leatherTextures.normalMap,
    normalScale: new THREE.Vector2(0.52, 0.52),
    roughnessMap: leatherTextures.roughnessMap,
    roughness: 0.93,
    metalness: 0,
    color: new THREE.Color("#ffffff"),
    vertexColors: true,
    sheen: 0.28,
    sheenColor: new THREE.Color("#d2ae8c"),
    sheenRoughness: 0.88,
    envMapIntensity: 0.26,
  });

  const thread = new THREE.MeshPhysicalMaterial({
    name: "Waxed linen thread",
    color: new THREE.Color("#4e3728"),
    roughness: 0.76,
    metalness: 0,
    sheen: 0.18,
    sheenColor: new THREE.Color("#b7835e"),
    sheenRoughness: 0.85,
    envMapIntensity: 0.15,
  });

  const emblem = new THREE.MeshStandardMaterial({
    name: "Pressed emblem",
    map: emblemTexture,
    transparent: true,
    depthWrite: false,
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const casebackEngraving = new THREE.MeshStandardMaterial({
    name: "Case back engraving",
    map: casebackTexture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    roughness: 0.5,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const crystal = new THREE.MeshPhysicalMaterial({
    name: "Domed mineral crystal",
    color: new THREE.Color("#ffffff"),
    metalness: 0,
    roughness: 0.03,
    transmission: 0,
    thickness: 0.01,
    ior: 1.5,
    transparent: true,
    opacity: 0.06,
    clearcoat: 0.8,
    clearcoatRoughness: 0.035,
    envMapIntensity: 0.95,
    side: THREE.FrontSide,
    depthWrite: false,
  });

  return {
    brushedSteel,
    brushedBezel,
    polishedSteel,
    casebackSteel,
    hardwareSteel,
    handsSteel,
    lugSteel,
    numeralSteel,
    darkSteel,
    blackSteel,
    dial,
    date,
    dialText,
    lume,
    lumeRim,
    secondsRed,
    handOutline,
    leather,
    thread,
    emblem,
    casebackEngraving,
    crystal,
    textures: {
      leather: leatherTextures,
      dial: dialTexture,
      date: dateTexture,
      emblem: emblemTexture,
      caseback: casebackTexture,
    },
  };
}
