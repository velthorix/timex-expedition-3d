import * as THREE from "three";

/* A self-contained jewellery studio, authored as an HDR environment.
   The metal needs dark negative space as much as it needs light: the bright
   softboxes become clean highlight bands while the blackened room gives the
   steel its depth. */

function addPanel(scene, { width, height, position, color, intensity }) {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  panel.position.set(...position);
  panel.lookAt(0, 0, 0);
  scene.add(panel);
  return panel;
}

export function createStudioEnvironment() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#100e0c");

  const roomMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#191613"),
    side: THREE.BackSide,
    toneMapped: false,
  });
  const room = new THREE.Mesh(new THREE.BoxGeometry(52, 52, 52), roomMaterial);
  scene.add(room);

  // Overhead bank, the broad source that shapes the bezel.
  addPanel(scene, {
    width: 14,
    height: 3.4,
    position: [0, 18, 1],
    color: "#fff4e3",
    intensity: 3.6,
  });

  // Tall key softbox, front left.
  addPanel(scene, {
    width: 7.5,
    height: 17,
    position: [-14, 4, 12],
    color: "#fff0d8",
    intensity: 3.7,
  });

  // Cool fill from the right keeps the steel from going sepia.
  addPanel(scene, {
    width: 6,
    height: 17,
    position: [14, 1, 7],
    color: "#e3edff",
    intensity: 2.2,
  });

  // Warm rim strip behind the watch.
  addPanel(scene, {
    width: 13,
    height: 3,
    position: [2, 6, -16],
    color: "#ffd6a6",
    intensity: 3.0,
  });

  // A narrow specular pin-stripe to draw a crisp line along polished edges.
  addPanel(scene, {
    width: 1,
    height: 16,
    position: [-6.5, 2, 16],
    color: "#ffffff",
    intensity: 4.2,
  });

  // A soft frontal fill, just enough to let the crystal catch a reflection.
  addPanel(scene, {
    width: 8,
    height: 6,
    position: [1, 3, 19],
    color: "#fff8ed",
    intensity: 1.05,
  });

  // Back-of-case light for the caseback view.
  addPanel(scene, {
    width: 7,
    height: 10,
    position: [12, 3, -13],
    color: "#e7f0ff",
    intensity: 1.2,
  });

  return scene;
}

export function disposeEnvironment(scene) {
  scene.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      }
    }
  });
}
