import * as THREE from "three";
import { applyShadows, latheMesh, TAU } from "./utils.js";

export const DIMENSIONS = {
  caseRadius: 1.18,
  bezelRadius: 1.315,
  dialRadius: 0.925,
  dialZ: 0.142,
  bezelFront: 0.372,
  crystalRadius: 0.892,
  lugTip: 1.575,
  strapWidth: 1.05,
};

/* ——————————————————————————————————————————————————————————————
   The lugs are four copies of a soft, sampled outline rather than boxes.
   A small negative margin at the roots lets them disappear cleanly under
   the turned case body.
—————————————————————————————————————————————————————————————— */
/* Lugs are lofted rather than extruded. A soft, tapered superellipse follows
   the horn from under the case to its rounded tip, so the silhouette stays
   organic from every angle instead of reading as a flat machined tab. */
function createLugGeometry(xSign, ySign) {
  const RINGS = 34;
  const SIDES = 28;
  const Y_START = 0.895;
  const Y_END = 1.44;
  const TIP_START = 0.93;
  const superellipse = 2.5;

  const positions = [];
  const uvs = [];
  const indices = [];

  const centerX = (t) => 0.66 - 0.058 * t * t + 0.018 * Math.sin(Math.PI * t);
  const centerZ = (t) => 0.012 - 0.042 * t * t;
  const halfWidth = (t) => 0.108 * (1 - 0.55 * t * t);
  const halfDepth = (t) => 0.086 * (1 - 0.4 * t * t);

  for (let ring = 0; ring < RINGS; ring++) {
    const t = (ring / (RINGS - 1)) * 0.96;
    const tipFade =
      t > TIP_START
        ? Math.sqrt(Math.max(0, 1 - ((t - TIP_START) / (0.96 - TIP_START)) ** 2))
        : 1;
    const cx = centerX(t);
    const cz = centerZ(t);
    const hw = halfWidth(t) * tipFade;
    const hd = halfDepth(t) * tipFade;
    const y = THREE.MathUtils.lerp(Y_START, Y_END, t);

    for (let side = 0; side <= SIDES; side++) {
      const theta = (side / SIDES) * TAU;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const sx = Math.sign(cos) * Math.abs(cos) ** (2 / superellipse);
      const sz = Math.sign(sin) * Math.abs(sin) ** (2 / superellipse);
      positions.push(cx + sx * hw, y, cz + sz * hd);
      uvs.push(side / SIDES, t);
    }
  }

  for (let ring = 0; ring < RINGS - 1; ring++) {
    for (let side = 0; side < SIDES; side++) {
      const a = ring * (SIDES + 1) + side;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  // Root cap, tucked away beneath the case.
  const rootCenter = positions.length / 3;
  positions.push(centerX(0), Y_START, centerZ(0));
  uvs.push(0.5, 0);
  for (let side = 0; side < SIDES; side++) {
    indices.push(rootCenter, side, side + 1);
  }

  // Small fan closes the rounded tip.
  const tipCenter = positions.length / 3;
  const lastRingStart = (RINGS - 1) * (SIDES + 1);
  positions.push(centerX(1), Y_END, centerZ(1));
  uvs.push(0.5, 1);
  for (let side = 0; side < SIDES; side++) {
    indices.push(tipCenter, lastRingStart + side + 1, lastRingStart + side);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  if (xSign < 0 || ySign < 0) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      position.setX(i, position.getX(i) * xSign);
      position.setY(i, position.getY(i) * ySign);
    }
    position.needsUpdate = true;
    if (xSign * ySign < 0) {
      const index = geometry.index.array;
      for (let i = 0; i < index.length; i += 3) {
        const swap = index[i + 1];
        index[i + 1] = index[i + 2];
        index[i + 2] = swap;
      }
      geometry.index.needsUpdate = true;
    }
  }

  geometry.computeVertexNormals();
  return geometry;
}

/* A softly fluted crown, built as a true revolved/lofted surface so the
   knurling catches a highlight at every angle. */
function createFlutedCrown(radius, length, flutes = 46, radialSegments = 192) {
  const profile = [
    [-length / 2, 0.79],
    [-length / 2 + 0.012, 0.93],
    [-length / 2 + 0.035, 1],
    [length / 2 - 0.04, 1],
    [length / 2 - 0.015, 0.92],
    [length / 2, 0.8],
  ];

  const positions = [];
  const uvs = [];
  const indices = [];

  profile.forEach(([x, scale], ring) => {
    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * TAU;
      const knurl = Math.cos(theta * flutes) * 0.0068;
      const r = radius * scale + knurl;
      positions.push(x, Math.sin(theta) * r, Math.cos(theta) * r);
      uvs.push(j / radialSegments, ring / (profile.length - 1));
    }
  });

  for (let ring = 0; ring < profile.length - 1; ring++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = ring * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createCase(materials) {
  const group = new THREE.Group();
  group.name = "Watch case";

  // Main turned case body, including the recess that holds the dial.
  const bodyProfile = [
    [0.0, -0.284],
    [0.48, -0.284],
    [0.72, -0.278],
    [0.91, -0.256],
    [1.05, -0.212],
    [1.125, -0.145],
    [1.165, -0.052],
    [1.18, 0.055],
    [1.175, 0.158],
    [1.15, 0.235],
    [1.105, 0.275],
    [1.045, 0.287],
    [0.997, 0.276],
    [0.988, 0.245],
    [0.988, 0.152],
    [0.976, 0.116],
    [0.95, 0.084],
    [0.907, 0.072],
    [0.0, 0.064],
  ];
  const body = latheMesh(bodyProfile, materials.brushedSteel, { segments: 192 });
  body.name = "Main case";
  group.add(body);

  // The broad sloped bezel. Its horizontally drawn roughness map becomes a
  // fine radial brushing when revolved.
  const bezelProfile = [
    [0.952, 0.292],
    [0.966, 0.318],
    [0.99, 0.342],
    [1.06, 0.356],
    [1.22, 0.356],
    [1.276, 0.344],
    [1.307, 0.312],
    [1.312, 0.276],
    [1.295, 0.246],
    [1.26, 0.232],
    [1.16, 0.236],
    [1.056, 0.246],
    [0.988, 0.26],
    [0.952, 0.292],
  ];
  const bezel = latheMesh(bezelProfile, materials.brushedBezel, { segments: 192 });
  bezel.name = "Bezel";
  group.add(bezel);

  // Polished lip that nests the crystal and catches a clean white rim light.
  const innerLip = latheMesh(
    [
      [0.888, 0.252],
      [0.893, 0.31],
      [0.905, 0.342],
      [0.935, 0.36],
      [0.968, 0.362],
      [0.973, 0.347],
      [0.943, 0.327],
      [0.918, 0.294],
      [0.908, 0.258],
      [0.888, 0.252],
    ],
    materials.polishedSteel,
    { segments: 192 }
  );
  innerLip.name = "Polished bezel lip";
  group.add(innerLip);

  // A fine polished edge encircling the brushed bezel.
  const outerEdge = new THREE.Mesh(
    new THREE.TorusGeometry(1.311, 0.012, 16, 200),
    materials.polishedSteel
  );
  outerEdge.position.z = 0.27;
  outerEdge.rotation.x = 0;
  group.add(outerEdge);

  // A dark seam keeps the separate machined parts legible.
  const seam = new THREE.Mesh(
    new THREE.TorusGeometry(1.181, 0.006, 8, 192),
    materials.blackSteel
  );
  seam.position.z = 0.238;
  group.add(seam);

  // The inner wall of the dial housing.
  const rehaut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.927, 0.927, 0.172, 128, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#c9c5bc"),
      metalness: 0.35,
      roughness: 0.52,
      envMapIntensity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  rehaut.rotation.x = Math.PI / 2;
  rehaut.position.z = 0.19;
  group.add(rehaut);

  // Sand-blasted dial seat.
  const seat = new THREE.Mesh(new THREE.CircleGeometry(0.93, 96), materials.darkSteel);
  seat.position.z = 0.071;
  group.add(seat);

  // Four softly rounded lugs.
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      const lug = new THREE.Mesh(createLugGeometry(xSign, ySign), materials.lugSteel);
      lug.name = `Lug ${xSign > 0 ? "right" : "left"} ${ySign > 0 ? "top" : "bottom"}`;
      // A slight rearward tilt lets the lugs flow into the case instead of
      // reading as flat tabs beside the bezel.
      lug.rotation.x = -ySign * 0.04;
      lug.castShadow = true;
      lug.receiveShadow = true;
      group.add(lug);
    }
  }

  // Spring bars sit inside the leather and run into the lugs, so only the
  // polished shoulders catch a glint in the gap beside the strap.
  for (const y of [-1.355, 1.355]) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.027, 0.027, 1.24, 24),
      materials.polishedSteel
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, y, -0.2);
    bar.castShadow = true;
    group.add(bar);
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.041, 0.041, 0.085, 24, 1, true),
      materials.darkSteel
    );
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0.605, y, -0.2);
    group.add(tube);
  }

  // — Crown
  const crown = new THREE.Group();
  crown.name = "Crown";
  crown.position.set(0, 0, 0.045);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.084, 0.21, 40),
    materials.polishedSteel
  );
  stem.rotation.z = Math.PI / 2;
  stem.position.x = 1.215;
  crown.add(stem);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.132, 0.06, 48),
    materials.brushedSteel
  );
  collar.rotation.z = Math.PI / 2;
  collar.position.x = 1.31;
  crown.add(collar);

  const knob = new THREE.Mesh(createFlutedCrown(0.173, 0.235), materials.polishedSteel);
  knob.position.x = 1.435;
  crown.add(knob);

  const crownEnd = new THREE.Mesh(
    new THREE.SphereGeometry(0.137, 48, 24, 0, TAU, 0, Math.PI / 2),
    materials.polishedSteel
  );
  crownEnd.scale.set(1, 0.3, 1);
  crownEnd.rotation.z = -Math.PI / 2;
  crownEnd.position.x = 1.548;
  crown.add(crownEnd);

  const endRing = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.008, 10, 48), materials.darkSteel);
  endRing.rotation.y = Math.PI / 2;
  endRing.position.x = 1.552;
  crown.add(endRing);

  applyShadows(crown);
  group.add(crown);

  // — Case back
  const backPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.035, 1.06, 0.046, 160),
    materials.casebackSteel
  );
  backPlate.rotation.x = Math.PI / 2;
  backPlate.position.z = -0.288;
  backPlate.castShadow = true;
  backPlate.receiveShadow = true;
  group.add(backPlate);

  const backRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.015, 0.015, 12, 160),
    materials.polishedSteel
  );
  backRing.position.z = -0.312;
  group.add(backRing);

  // A machined groove and a small stepped medallion ring frame the engraving.
  const backGroove = new THREE.Mesh(
    new THREE.TorusGeometry(0.905, 0.008, 8, 160),
    materials.blackSteel
  );
  backGroove.position.z = -0.313;
  group.add(backGroove);

  const backStep = new THREE.Mesh(
    new THREE.TorusGeometry(0.878, 0.011, 10, 160),
    materials.polishedSteel
  );
  backStep.position.z = -0.316;
  group.add(backStep);

  const engraving = new THREE.Mesh(new THREE.CircleGeometry(0.865, 128), materials.casebackEngraving);
  engraving.rotation.y = Math.PI;
  engraving.position.z = -0.314;
  group.add(engraving);

  // Six small tool notches around the case back.
  const notchGeometry = new THREE.BoxGeometry(0.046, 0.02, 0.018);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU;
    const notch = new THREE.Mesh(notchGeometry, materials.blackSteel);
    notch.position.set(Math.sin(angle) * 1.003, Math.cos(angle) * 1.003, -0.315);
    notch.rotation.z = -angle;
    group.add(notch);
  }

  applyShadows(group, true, true);
  // The crystal ought not cast a heavy opaque shadow onto the dial.
  engraving.castShadow = false;
  group.userData.crown = crown;
  return group;
}
