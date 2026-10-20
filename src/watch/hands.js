import * as THREE from "three";
import { applyShadows, TAU } from "./utils.js";

const DIAL_Z = 0.142;

function shapeFromOutline(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();
  return shape;
}

function extrudePointer(points, depth, bevel = 0.0025) {
  const geometry = new THREE.ExtrudeGeometry(shapeFromOutline(points), {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 4,
  });
  geometry.computeVertexNormals();
  return geometry;
}

function addHand(baseZ, outerPoints, lumePoints, materials, name) {
  const group = new THREE.Group();
  group.name = name;
  group.position.z = baseZ;

  // A dark breathing edge makes the pale polished steel legible against the
  // ivory dial, the way a printed keyline does on a real hand.
  const keylinePoints = outerPoints.map(([x, y]) => [x * 1.09, y * 1.09]);
  const keyline = new THREE.Mesh(
    extrudePointer(keylinePoints, 0.012, 0.002),
    materials.handOutline
  );
  keyline.position.z = -0.003;
  keyline.castShadow = false;
  keyline.receiveShadow = false;
  group.add(keyline);

  const outer = new THREE.Mesh(extrudePointer(outerPoints, 0.014, 0.0028), materials.handsSteel);
  outer.castShadow = true;
  outer.receiveShadow = true;
  group.add(outer);

  const lume = new THREE.Mesh(extrudePointer(lumePoints, 0.006, 0.0016), materials.lume);
  lume.position.z = 0.0145;
  lume.castShadow = true;
  lume.receiveShadow = true;
  group.add(lume);

  // A hairline of shadow inside the silver bezel of the hand.
  const rim = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      outerPoints.map(([x, y]) => new THREE.Vector3(x, y, 0.0155))
    ),
    new THREE.LineBasicMaterial({
      color: 0x413d36,
      transparent: true,
      opacity: 0.5,
    })
  );
  group.add(rim);

  return group;
}

const HOUR_OUTLINE = [
  [-0.014, -0.06],
  [-0.048, 0.01],
  [-0.064, 0.09],
  [-0.047, 0.225],
  [-0.023, 0.37],
  [0, 0.45],
  [0.023, 0.37],
  [0.047, 0.225],
  [0.064, 0.09],
  [0.048, 0.01],
  [0.014, -0.06],
];

const HOUR_LUME = [
  [-0.005, -0.03],
  [-0.028, 0.02],
  [-0.039, 0.1],
  [-0.023, 0.235],
  [-0.007, 0.34],
  [0, 0.382],
  [0.007, 0.34],
  [0.023, 0.235],
  [0.039, 0.1],
  [0.028, 0.02],
  [0.005, -0.03],
];

const MINUTE_OUTLINE = [
  [-0.01, -0.065],
  [-0.04, 0.02],
  [-0.044, 0.095],
  [-0.028, 0.41],
  [-0.011, 0.68],
  [0, 0.76],
  [0.011, 0.68],
  [0.028, 0.41],
  [0.044, 0.095],
  [0.04, 0.02],
  [0.01, -0.065],
];

const MINUTE_LUME = [
  [-0.003, -0.036],
  [-0.021, 0.032],
  [-0.026, 0.115],
  [-0.011, 0.44],
  [-0.004, 0.64],
  [0, 0.682],
  [0.004, 0.64],
  [0.011, 0.44],
  [0.026, 0.115],
  [0.021, 0.032],
  [0.003, -0.036],
];

function createSecondsHand(materials) {
  const group = new THREE.Group();
  group.name = "Seconds hand";
  group.position.z = DIAL_Z + 0.083;

  const shape = new THREE.Shape();
  shape.moveTo(-0.006, -0.072);
  shape.lineTo(-0.008, 0.66);
  shape.lineTo(-0.018, 0.74);
  shape.lineTo(0, 0.81);
  shape.lineTo(0.018, 0.74);
  shape.lineTo(0.008, 0.66);
  shape.lineTo(0.006, -0.072);
  shape.lineTo(0.028, -0.09);
  shape.lineTo(0.028, -0.119);
  shape.lineTo(-0.028, -0.119);
  shape.lineTo(-0.028, -0.09);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.005,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.0017,
    bevelThickness: 0.0017,
    curveSegments: 3,
  });
  const pointer = new THREE.Mesh(geometry, materials.secondsRed);
  pointer.castShadow = true;
  pointer.receiveShadow = true;
  group.add(pointer);

  const counterweight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.007, 40),
    materials.secondsRed
  );
  counterweight.rotation.x = Math.PI / 2;
  counterweight.position.set(0, -0.096, 0.004);
  counterweight.castShadow = true;
  counterweight.receiveShadow = true;
  group.add(counterweight);

  const counterweightHole = new THREE.Mesh(
    new THREE.TorusGeometry(0.0165, 0.0025, 6, 32),
    materials.handsSteel
  );
  counterweightHole.position.set(0, -0.096, 0.009);
  group.add(counterweightHole);

  return group;
}

function createCenterPin(materials) {
  const group = new THREE.Group();
  group.name = "Center pin";
  group.position.z = DIAL_Z + 0.098;

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.018, 48),
    materials.polishedSteel
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.z = 0.005;
  collar.castShadow = true;
  collar.receiveShadow = true;
  group.add(collar);

  const recess = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.046, 0.018, 48),
    materials.blackSteel
  );
  recess.rotation.x = Math.PI / 2;
  recess.position.z = 0.015;
  group.add(recess);

  const centre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.029, 0.031, 0.022, 40),
    materials.secondsRed
  );
  centre.rotation.x = Math.PI / 2;
  centre.position.z = 0.023;
  centre.castShadow = true;
  group.add(centre);

  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 20, 10, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#d6473b"),
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    })
  );
  glint.rotation.x = Math.PI / 2;
  glint.scale.y = 0.35;
  glint.position.z = 0.034;
  group.add(glint);

  return group;
}

export function createHands(materials) {
  const group = new THREE.Group();
  group.name = "Hands";

  const hour = addHand(DIAL_Z + 0.051, HOUR_OUTLINE, HOUR_LUME, materials, "Hour hand");
  const minute = addHand(DIAL_Z + 0.064, MINUTE_OUTLINE, MINUTE_LUME, materials, "Minute hand");
  const second = createSecondsHand(materials);
  const pin = createCenterPin(materials);

  group.add(hour, minute, second, pin);
  applyShadows(group, true, true);
  // Hands are too small for the VSM shadow map to self-shadow cleanly; they
  // still cast their silhouettes onto the dial, but never receive shadow.
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });

  return {
    group,
    hour,
    minute,
    second,
    pin,
  };
}
