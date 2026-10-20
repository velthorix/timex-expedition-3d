import * as THREE from "three";
import {
  applyShadows,
  roundedRectPath,
  roundedRectShape,
  superellipsePoint,
  TAU,
} from "./utils.js";

const STRAP = {
  rootY: 0.92,
  length: 2.66,
  rootZ: -0.145,
  endZDrop: 0.45,
  stations: 136,
  sides: 32,
  superellipse: 4.15,
  stitchCount: 33,
};

// Both free ends get a rounded, slightly curled tail instead of a flat cut.
// The upper end is kept restrained so it stays clear of the page header; the
// lower end runs longer past the buckle.
const UPPER_TIP = {
  endT: 1.135,
  taperStart: 1.028,
  bend: 0.05,
  stitchCount: 39,
  stitchEndT: 1.105,
  rings: 32,
};

const LOWER_TIP = {
  endT: 1.26,
  taperStart: 1.195,
  bend: 0.15,
  stitchCount: 48,
  stitchEndT: 1.23,
  rings: 64,
};

function smootherstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function widthAt(t) {
  if (t < 0.18) {
    return THREE.MathUtils.lerp(0.99, 1.055, smootherstep(t / 0.18));
  }
  return THREE.MathUtils.lerp(1.055, 0.872, smootherstep((t - 0.18) / 0.82));
}

function thicknessAt(t) {
  return 0.128 - 0.021 * t;
}

function pathPoint(t) {
  return new THREE.Vector3(
    0,
    STRAP.rootY + STRAP.length * t,
    STRAP.rootZ - STRAP.endZDrop * Math.pow(t, 1.55) - 0.026 * Math.sin(Math.PI * t)
  );
}

function frameAt(t) {
  const tangent = new THREE.Vector3(
    0,
    STRAP.length,
    -STRAP.endZDrop * 1.55 * Math.pow(Math.max(t, 0.0001), 0.55) -
      0.026 * Math.PI * Math.cos(Math.PI * t)
  ).normalize();

  // Project global +Z into the plane perpendicular to the strap, then build
  // a right-handed frame: lateral (X), along strap (Y), out of leather (Z).
  const front = new THREE.Vector3(0, 0, 1);
  front.addScaledVector(tangent, -tangent.dot(front)).normalize();
  const lateral = tangent.clone().cross(front).normalize();
  return { tangent, front, lateral };
}

function topSurfaceAt(t, lateralOffset) {
  const halfWidth = widthAt(t) / 2;
  const halfThickness = thicknessAt(t) / 2;
  const ratio = THREE.MathUtils.clamp(Math.abs(lateralOffset) / halfWidth, 0, 1);
  const y =
    halfThickness *
    Math.pow(Math.max(0, 1 - Math.pow(ratio, STRAP.superellipse)), 1 / STRAP.superellipse);
  return y;
}

function tipTaperAt(t, tip) {
  if (t <= tip.taperStart) return 1;
  const u = THREE.MathUtils.clamp(
    (t - tip.taperStart) / (tip.endT - tip.taperStart),
    0,
    1
  );
  return Math.sqrt(Math.max(0, 1 - u * u));
}

function tipWidthAt(t, tip) {
  return widthAt(Math.min(t, 1)) * tipTaperAt(t, tip);
}

function tipThicknessAt(t, tip) {
  return thicknessAt(Math.min(t, 1)) * (0.38 + 0.62 * tipTaperAt(t, tip));
}

function tipPathPoint(t, tip) {
  const point = pathPoint(t);
  if (t > 1) {
    const bend = smootherstep((t - 1) / (tip.endT - 1));
    point.z += tip.bend * bend;
  }
  return point;
}

function tipFrameAt(t, tip) {
  // The curled tip changes the tangent. A short numeric derivative keeps the
  // cross-sections perpendicular to the leather all the way through the bend.
  const h = 0.0012;
  const a = tipPathPoint(Math.max(0, t - h), tip);
  const b = tipPathPoint(Math.min(tip.endT, t + h), tip);
  const tangent = b.sub(a).normalize();
  const front = new THREE.Vector3(0, 0, 1);
  front.addScaledVector(tangent, -tangent.dot(front)).normalize();
  const lateral = tangent.clone().cross(front).normalize();
  return { tangent, front, lateral };
}

function tipSurfaceAt(t, lateralOffset, tip) {
  const halfWidth = tipWidthAt(t, tip) / 2;
  const halfThickness = tipThicknessAt(t, tip) / 2;
  const ratio = THREE.MathUtils.clamp(Math.abs(lateralOffset) / halfWidth, 0, 1);
  return (
    halfThickness *
    Math.pow(Math.max(0, 1 - Math.pow(ratio, STRAP.superellipse)), 1 / STRAP.superellipse)
  );
}

function createLeatherGeometry({ tip = null } = {}) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const { sides } = STRAP;
  const color = new THREE.Color();
  const randomSeed = (n) => {
    const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  const tValues = [];
  for (let i = 0; i <= STRAP.stations; i++) {
    tValues.push(i / STRAP.stations);
  }
  if (tip) {
    // Add a dense cluster of rings through the free end, biased toward the
    // rounded tip so the taper stays smooth at every viewing angle.
    const span = tip.endT - 1;
    for (let i = 1; i <= tip.rings; i++) {
      const u = i / (tip.rings + 1);
      const eased = 1 - Math.pow(1 - u, 1.85);
      tValues.push(1 + span * eased);
    }
  }

  const stationCount = tValues.length - 1;
  const getCenter = tip ? (t) => tipPathPoint(t, tip) : pathPoint;
  const getFrame = tip ? (t) => tipFrameAt(t, tip) : frameAt;
  const getHalfWidth = tip
    ? (t) => tipWidthAt(t, tip) / 2
    : (t) => widthAt(t) / 2;
  const getHalfThickness = tip
    ? (t) => tipThicknessAt(t, tip) / 2
    : (t) => thicknessAt(t) / 2;

  for (let i = 0; i < tValues.length; i++) {
    const t = tValues[i];
    const center = getCenter(t);
    const frame = getFrame(t);
    const halfWidth = getHalfWidth(t);
    const halfThickness = getHalfThickness(t);

    for (let j = 0; j < sides; j++) {
      // Begin the UV seam along the underside of the strap, where it cannot
      // be seen during normal inspection.
      const theta = -Math.PI / 2 + (j / sides) * TAU;
      const [x, y] = superellipsePoint(theta, halfWidth, halfThickness, STRAP.superellipse);
      const point = center
        .clone()
        .addScaledVector(frame.lateral, x)
        .addScaledVector(frame.front, y);
      positions.push(point.x, point.y, point.z);

      uvs.push(j / sides, t);

      // Natural edge burnishing and a slightly darker flesh side. A gentle
      // random mottling keeps the leather from looking painted.
      const edge = Math.pow(Math.abs(Math.cos(theta)), 3.2);
      const underside = Math.sin(theta) < 0 ? 0.28 : 0;
      const mottle = (randomSeed(i * 8.13 + j * 3.71) - 0.5) * 0.03;
      const shade = THREE.MathUtils.clamp(1 - edge * 0.52 - underside + mottle, 0.28, 1);
      color.setRGB(shade, shade * 0.985, shade * 0.955);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let i = 0; i < stationCount; i++) {
    for (let j = 0; j < sides; j++) {
      const next = (j + 1) % sides;
      const a = i * sides + j;
      const b = (i + 1) * sides + j;
      const c = i * sides + next;
      const d = (i + 1) * sides + next;
      indices.push(a, b, c, b, d, c);
    }
  }

  // Close the free end with a softly rounded centre and the root with a flat
  // cap. The root disappears beneath the watch case.
  const addCap = (t, ringStart, centerOffset, flip) => {
    const center = getCenter(t);
    const frame = getFrame(t);
    center.addScaledVector(frame.tangent, centerOffset);
    const centerIndex = positions.length / 3;
    const topColor = 0.86;
    positions.push(center.x, center.y, center.z);
    uvs.push(0.5, t);
    colors.push(topColor, topColor * 0.985, topColor * 0.955);

    for (let j = 0; j < sides; j++) {
      const next = (j + 1) % sides;
      const a = ringStart + j;
      const b = ringStart + next;
      if (flip) {
        indices.push(b, a, centerIndex);
      } else {
        indices.push(a, b, centerIndex);
      }
    }
  };

  addCap(0, 0, -0.018, false);
  addCap(tip ? tip.endT : 1, stationCount * sides, tip ? 0.012 : 0.02, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createStitchInstances(material, { underside = false, tip = null } = {}) {
  const geometry = new THREE.CapsuleGeometry(0.0062, 0.049, 4, 8);
  const stitchCount = tip ? tip.stitchCount : STRAP.stitchCount;
  const count = stitchCount * 2;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = underside ? "Under-stitching" : "Saddle stitching";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const matrix = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const tilt = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const scale = new THREE.Vector3(0.84, 1, 0.64);
  const up = new THREE.Vector3(0, 1, 0);
  const getCenter = tip ? (t) => tipPathPoint(t, tip) : pathPoint;
  const getFrame = tip ? (t) => tipFrameAt(t, tip) : frameAt;
  const getWidth = tip ? (t) => tipWidthAt(t, tip) : widthAt;
  const getSurface = tip ? (t, lateral) => tipSurfaceAt(t, lateral, tip) : topSurfaceAt;
  const endT = tip ? tip.stitchEndT : 0.955;

  let instance = 0;
  for (let step = 0; step < stitchCount; step++) {
    const t = 0.07 + (step / (stitchCount - 1)) * (endT - 0.07);
    const center = getCenter(t);
    const frame = getFrame(t);
    const width = getWidth(t);

    for (const side of [-1, 1]) {
      const lateral = width * 0.365 * side;
      const surface = getSurface(t, lateral);
      normal.copy(frame.front).multiplyScalar(underside ? -1 : 1);
      position
        .copy(center)
        .addScaledVector(frame.lateral, lateral)
        .addScaledVector(normal, surface + 0.004);
      basis.makeBasis(frame.lateral, frame.tangent, normal);
      quaternion.setFromRotationMatrix(basis);
      const angle = (step % 2 === 0 ? 1 : -1) * (0.045 + (step % 3) * 0.012);
      tilt.setFromAxisAngle(up, angle);
      quaternion.multiply(tilt);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(instance, matrix);
      instance++;
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function addInstanceColorAttribute(geometry, shade = 0.86) {
  const count = geometry.attributes.position.count;
  const values = new Float32Array(count * 3);
  values.fill(shade);
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(values, 3));
  return geometry;
}

function strapSurfacePoint(t, lateral = 0, extra = 0) {
  const center = pathPoint(t);
  const frame = frameAt(t);
  const surface = topSurfaceAt(t, lateral);
  return center
    .clone()
    .addScaledVector(frame.lateral, lateral)
    .addScaledVector(frame.front, surface + extra);
}

function createLeatherKeepers(materials) {
  const group = new THREE.Group();
  group.name = "Leather keepers";
  const geometry = addInstanceColorAttribute(
    new THREE.TorusGeometry(0.52, 0.032, 10, 56),
    0.68
  );

  for (const t of [0.78, 0.845]) {
    const keeper = new THREE.Mesh(geometry, materials.leather);
    keeper.rotation.x = Math.PI / 2 - 0.26;
    keeper.scale.set(0.96, 0.33, 1.9);
    const center = pathPoint(t);
    keeper.position.set(0, -(STRAP.rootY + STRAP.length * t), center.z);
    keeper.castShadow = true;
    keeper.receiveShadow = true;
    group.add(keeper);
  }

  return group;
}

function createStrapHoles(materials) {
  const group = new THREE.Group();
  group.name = "Punched adjustment holes";

  const holeGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.006, 24);
  const ringGeometry = new THREE.TorusGeometry(0.043, 0.0045, 6, 28);

  for (const t of [0.79, 0.85, 0.91, 0.97]) {
    const point = strapSurfacePoint(t, 0, 0.002);
    const hole = new THREE.Mesh(holeGeometry, materials.blackSteel);
    hole.rotation.x = Math.PI / 2;
    hole.position.copy(point);
    group.add(hole);

    const ring = new THREE.Mesh(ringGeometry, materials.darkSteel);
    ring.position.copy(point).add(new THREE.Vector3(0, 0, 0.002));
    group.add(ring);
  }

  return group;
}

function createBuckle(materials) {
  const group = new THREE.Group();
  group.name = "Steel pin buckle";

  const outerWidth = 0.92;
  const outerHeight = 0.5;
  const band = 0.068;
  const radius = 0.075;

  const shape = roundedRectShape(outerWidth, outerHeight, radius);
  shape.holes.push(
    roundedRectPath(outerWidth - band * 2, outerHeight - band * 2, radius * 0.6)
  );

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.052,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -0.026);

  const frame = new THREE.Mesh(geometry, materials.hardwareSteel);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, outerWidth - band * 2 - 0.02, 18),
    materials.hardwareSteel
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.1, 0.005);
  bar.castShadow = true;
  group.add(bar);

  const prong = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.018, 0.33, 14),
    materials.hardwareSteel
  );
  prong.position.set(0, -0.055, 0.018);
  prong.castShadow = true;
  group.add(prong);

  const prongTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 16, 10),
    materials.hardwareSteel
  );
  prongTip.position.set(0, -0.22, 0.018);
  group.add(prongTip);

  // Let the buckle sit on the outside of the lower strap, near its tip.
  const center = pathPoint(0.925);
  group.position.set(0, -(STRAP.rootY + STRAP.length * 0.925), center.z + 0.108);

  return group;
}

function createEmbossedLogo(material, { bottom = false } = {}) {
  const centerT = 0.4;
  const width = 0.44;
  const height = 0.3;
  const segmentsX = 18;
  const segmentsY = 14;
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const position = geometry.attributes.position;
  const point = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const ly = position.getY(i);
    // The decal stays upright regardless of which strap section it sits on.
    const t = THREE.MathUtils.clamp(centerT + (bottom ? -ly : ly) / STRAP.length, 0.25, 0.7);
    const center = pathPoint(t);
    const frame = frameAt(t);
    const lateral = lx;
    const surface = topSurfaceAt(t, lateral);
    // Use the mirrored path directly for the lower section.
    point.copy(center).addScaledVector(frame.lateral, lateral).addScaledVector(frame.front, surface + 0.008);
    if (bottom) {
      point.y = -point.y;
    }
    position.setXYZ(i, point.x, point.y, point.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = bottom ? "Lower strap emblem" : "Upper strap emblem";
  mesh.renderOrder = 3;
  mesh.receiveShadow = true;
  return mesh;
}

export function createStrap(materials) {
  const group = new THREE.Group();
  group.name = "Leather strap";

  const geometry = createLeatherGeometry({ tip: UPPER_TIP });
  const stitches = createStitchInstances(materials.thread, { tip: UPPER_TIP });
  const underStitches = createStitchInstances(materials.thread, {
    underside: true,
    tip: UPPER_TIP,
  });

  const strapMesh = new THREE.Mesh(geometry, materials.leather);
  strapMesh.name = "Full-grain strap";
  strapMesh.castShadow = true;
  strapMesh.receiveShadow = true;

  const top = new THREE.Group();
  top.name = "Upper strap";
  top.add(strapMesh, stitches, underStitches);
  group.add(top);

  // One carefully built strap is mirrored for the lower half. Rotating around
  // Z preserves the brushed/grain direction and the front surface normal.
  const bottom = new THREE.Group();
  bottom.name = "Lower strap";
  bottom.rotation.z = Math.PI;
  const bottomGeometry = createLeatherGeometry({ tip: LOWER_TIP });
  const bottomMesh = new THREE.Mesh(bottomGeometry, materials.leather);
  const bottomStitches = createStitchInstances(materials.thread, { tip: LOWER_TIP });
  const bottomUnderStitches = createStitchInstances(materials.thread, {
    underside: true,
    tip: LOWER_TIP,
  });
  bottomMesh.name = "Full-grain strap (lower)";
  bottomMesh.castShadow = true;
  bottomMesh.receiveShadow = true;
  bottomStitches.name = "Saddle stitching (lower)";
  bottomUnderStitches.name = "Under-stitching (lower)";
  bottom.add(bottomMesh, bottomStitches, bottomUnderStitches);
  group.add(bottom);

  const upperEmblem = createEmbossedLogo(materials.emblem, { bottom: false });
  const lowerEmblem = createEmbossedLogo(materials.emblem, { bottom: true });
  group.add(upperEmblem, lowerEmblem);

  const keepers = createLeatherKeepers(materials);
  const holes = createStrapHoles(materials);
  const buckle = createBuckle(materials);
  group.add(keepers, holes, buckle);

  applyShadows(group, true, true);
  upperEmblem.castShadow = false;
  lowerEmblem.castShadow = false;

  return {
    group,
    top,
    bottom,
    geometry,
    lowerGeometry: bottomGeometry,
    hardware: { keepers, holes, buckle },
    emblemMeshes: [upperEmblem, lowerEmblem],
  };
}
