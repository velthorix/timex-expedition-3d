import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import {
  applyShadows,
  lathe,
  roundedRectPath,
  roundedRectShape,
  setShadow,
  TAU,
} from "./utils.js";
import { DIMENSIONS } from "./case.js";

const DATE = {
  x: 0.535,
  y: -0.003,
  holeWidth: 0.282,
  holeHeight: 0.198,
  windowWidth: 0.266,
  windowHeight: 0.184,
  frameWidth: 0.334,
  frameHeight: 0.252,
};

function createDateShape(width, height, radius) {
  return roundedRectShape(width, height, radius);
}

function createDialGeometry() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.927, 0, TAU, false);

  const hole = new THREE.Path();
  const w = DATE.holeWidth / 2;
  const h = DATE.holeHeight / 2;
  const r = 0.018;
  const cx = DATE.x;
  const cy = DATE.y;
  hole.moveTo(cx - w + r, cy - h);
  hole.lineTo(cx + w - r, cy - h);
  hole.quadraticCurveTo(cx + w, cy - h, cx + w, cy - h + r);
  hole.lineTo(cx + w, cy + h - r);
  hole.quadraticCurveTo(cx + w, cy + h, cx + w - r, cy + h);
  hole.lineTo(cx - w + r, cy + h);
  hole.quadraticCurveTo(cx - w, cy + h, cx - w, cy + h - r);
  hole.lineTo(cx - w, cy - h + r);
  hole.quadraticCurveTo(cx - w, cy - h, cx - w + r, cy - h);
  shape.holes.push(hole);

  const geometry = new THREE.ShapeGeometry(shape, 128);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  // The dial print canvas is centred in a square. Remap the shape's
  // raw x/y UVs so the artwork lands in exactly the right place.
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + 0.927) / 1.854, (pos.getY(i) + 0.927) / 1.854);
  }
  uv.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createDateAssembly(materials) {
  const group = new THREE.Group();
  group.name = "Date window";

  // Recessed date wheel, sitting behind the dial surface.
  const datePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.205), materials.date);
  datePlane.position.set(DATE.x, DATE.y, DIMENSIONS.dialZ - 0.022);
  datePlane.receiveShadow = true;
  group.add(datePlane);

  // A deep dark chamber behind the wheel so no light leaks through.
  const chamber = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.28), materials.blackSteel);
  chamber.position.set(DATE.x, DATE.y, DIMENSIONS.dialZ - 0.026);
  group.add(chamber);

  // Black gasket around the date print.
  const gasketShape = createDateShape(0.322, 0.242, 0.021);
  const gasketHole = roundedRectPath(0.258, 0.176, 0.011);
  gasketShape.holes.push(gasketHole);
  const gasket = new THREE.Mesh(new THREE.ShapeGeometry(gasketShape, 24), materials.blackSteel);
  gasket.position.set(DATE.x, DATE.y, DIMENSIONS.dialZ + 0.001);
  group.add(gasket);

  // Brushed/polished metal frame. The shallow bevel catches a highlight
  // along its top edge, just as it does on the reference.
  const frameShape = createDateShape(DATE.frameWidth, DATE.frameHeight, 0.023);
  const frameHole = roundedRectPath(0.272, 0.188, 0.011);
  frameShape.holes.push(frameHole);
  const frameGeometry = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.0045,
    bevelThickness: 0.004,
    curveSegments: 18,
  });
  frameGeometry.translate(0, 0, -0.002);
  const frame = new THREE.Mesh(frameGeometry, materials.polishedSteel);
  frame.position.set(DATE.x, DATE.y, DIMENSIONS.dialZ + 0.001);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  // A whisper of shadow where the frame meets the dial.
  const shadowShape = createDateShape(DATE.frameWidth + 0.012, DATE.frameHeight + 0.012, 0.025);
  const shadowHole = roundedRectPath(DATE.windowWidth + 0.04, DATE.windowHeight + 0.04, 0.014);
  shadowShape.holes.push(shadowHole);
  const frameShadow = new THREE.Mesh(
    new THREE.ShapeGeometry(shadowShape, 24),
    new THREE.MeshBasicMaterial({ color: 0x1a1713, transparent: true, opacity: 0.22, depthWrite: false })
  );
  frameShadow.position.set(DATE.x, DATE.y, DIMENSIONS.dialZ - 0.002);
  group.add(frameShadow);

  return group;
}

function createMinuteDots(materials) {
  const group = new THREE.Group();
  group.name = "Luminous hour markers";

  const diskGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.008, 28);
  const rimGeometry = new THREE.TorusGeometry(0.0287, 0.0024, 8, 32);
  const diskMaterial = materials.lume;
  const rimMaterial = materials.darkSteel;

  const pipCount = 12;
  const diskInstances = new THREE.InstancedMesh(diskGeometry, diskMaterial, pipCount);
  const rimInstances = new THREE.InstancedMesh(rimGeometry, rimMaterial, pipCount);
  diskInstances.name = "Lume pips";
  rimInstances.name = "Lume pip rims";

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const rimQuaternion = new THREE.Quaternion();

  for (let i = 0; i < pipCount; i++) {
    const angle = (i / 12) * TAU;
    // Keep the familiar lume dot at twelve, but give it a touch more presence.
    scale.setScalar(i === 0 ? 1.2 : 1);
    position.set(Math.sin(angle) * 0.793, Math.cos(angle) * 0.793, DIMENSIONS.dialZ + 0.007);
    matrix.compose(position, quaternion, scale);
    diskInstances.setMatrixAt(i, matrix);

    position.z = DIMENSIONS.dialZ + 0.013;
    matrix.compose(position, rimQuaternion, scale);
    rimInstances.setMatrixAt(i, matrix);
  }

  diskInstances.instanceMatrix.needsUpdate = true;
  rimInstances.instanceMatrix.needsUpdate = true;
  diskInstances.receiveShadow = true;
  rimInstances.receiveShadow = true;
  group.add(diskInstances, rimInstances);
  return group;
}

function createEmblem(materials) {
  const group = new THREE.Group();
  group.name = "12 o'clock emblem";
  group.position.set(0, 0.575, DIMENSIONS.dialZ);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.067, 0.012, 48),
    materials.polishedSteel
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.z = 0.006;
  disc.castShadow = true;
  disc.receiveShadow = true;
  group.add(disc);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.0025, 8, 40), materials.darkSteel);
  ring.position.z = 0.012;
  group.add(ring);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.122, 0.122), materials.emblem);
  face.position.z = 0.0128;
  face.renderOrder = 2;
  group.add(face);

  return group;
}

function createNumerals(font, materials) {
  const group = new THREE.Group();
  group.name = "Raised Arabic numerals";

  const outlineMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2d2a24"),
    roughness: 0.82,
    metalness: 0.12,
    envMapIntensity: 0.18,
  });

  for (let hour = 1; hour <= 11; hour++) {
    if (hour === 3) continue; // date aperture replaces the three
    const angle = (hour / 12) * TAU;
    const radius = hour === 6 ? 0.656 : 0.654;
    const targetHeight = hour === 1 || hour === 11 ? 0.205 : 0.21;

    const geometry = new TextGeometry(String(hour), {
      font,
      size: 0.3,
      depth: 0.034,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.0045,
      bevelSegments: 3,
    });

    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const rawHeight = bounds.max.y - bounds.min.y;
    const scaleFactor = targetHeight / rawHeight;
    geometry.scale(scaleFactor, scaleFactor, scaleFactor);
    geometry.computeBoundingBox();
    const sized = geometry.boundingBox;
    geometry.translate(
      -(sized.max.x + sized.min.x) / 2,
      -(sized.max.y + sized.min.y) / 2,
      0
    );

    const x = Math.sin(angle) * radius;
    const y = Math.cos(angle) * radius;

    // Soft dark keyline. It sits behind the raised metal and is only visible
    // as a hairline, giving the numerals weight against the pale dial.
    const outlineGeometry = geometry.clone();
    outlineGeometry.scale(1.1, 1.1, 1);
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.position.set(x, y, DIMENSIONS.dialZ - 0.002);
    outline.castShadow = false;
    outline.receiveShadow = false;
    group.add(outline);

    const numeral = new THREE.Mesh(geometry, materials.numeralSteel);
    numeral.position.set(x, y, DIMENSIONS.dialZ + 0.006);
    numeral.castShadow = true;
    numeral.receiveShadow = true;
    numeral.name = `Numeral ${hour}`;
    group.add(numeral);
  }

  return group;
}

function createCrystal(materials) {
  const points = [];
  const radius = DIMENSIONS.crystalRadius;
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * radius;
    const normalized = r / radius;
    const z = 0.327 + 0.046 * (1 - normalized * normalized);
    points.push(new THREE.Vector2(r, z));
  }
  const geometry = lathe(points, 128);
  const crystal = new THREE.Mesh(geometry, materials.crystal);
  crystal.rotation.x = Math.PI / 2;
  crystal.name = "Crystal";
  crystal.castShadow = false;
  crystal.receiveShadow = false;
  crystal.renderOrder = 8;
  return crystal;
}

export function createDial(font, materials) {
  const group = new THREE.Group();
  group.name = "Dial";

  const dial = new THREE.Mesh(createDialGeometry(), materials.dial);
  dial.name = "Ivory dial plate";
  dial.position.z = DIMENSIONS.dialZ;
  dial.receiveShadow = true;
  dial.castShadow = false;
  group.add(dial);

  group.add(createMinuteDots(materials));
  group.add(createDateAssembly(materials));
  group.add(createNumerals(font, materials));

  const crystal = createCrystal(materials);
  group.add(crystal);

  // A restrained secondary reflection layer gives the glass a studio sheen
  // without masking the print. It is toggled with the crystal.
  const glareCanvas = document.createElement("canvas");
  glareCanvas.width = 512;
  glareCanvas.height = 512;
  const glareCtx = glareCanvas.getContext("2d");
  glareCtx.clearRect(0, 0, 512, 512);

  const softReflection = (cx, cy, rx, ry, rotation, peak) => {
    glareCtx.save();
    glareCtx.translate(cx, cy);
    glareCtx.rotate(rotation);
    glareCtx.scale(rx, ry);
    const gradient = glareCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(255,255,255,${peak})`);
    gradient.addColorStop(0.45, `rgba(255,255,255,${peak * 0.38})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    glareCtx.fillStyle = gradient;
    glareCtx.beginPath();
    glareCtx.arc(0, 0, 1, 0, TAU);
    glareCtx.fill();
    glareCtx.restore();
  };

  // A narrow softbox catch in the upper-left quadrant, sitting mostly on the
  // rehaut rather than across the hour numerals.
  softReflection(114, 132, 66, 14, -0.55, 0.16);
  // A fine echo on the opposite side suggests the domed surface.
  softReflection(388, 382, 36, 6, -0.3, 0.12);
  // The faintest milky sheen across the upper right, so the glass reads even
  // when the bright rim catches are outside the crop.
  softReflection(340, 300, 150, 92, -0.35, 0.035);

  // A narrow rim catch-light along the upper-left edge of the glass.
  const rimGradient = glareCtx.createLinearGradient(70, 160, 280, 390);
  rimGradient.addColorStop(0, "rgba(255,255,255,0)");
  rimGradient.addColorStop(0.5, "rgba(255,255,255,0.32)");
  rimGradient.addColorStop(1, "rgba(255,255,255,0)");
  glareCtx.strokeStyle = rimGradient;
  glareCtx.lineWidth = 3;
  glareCtx.beginPath();
  glareCtx.arc(256, 256, 238, Math.PI * 1.08, Math.PI * 1.55);
  glareCtx.stroke();

  glareCtx.strokeStyle = "rgba(255,255,255,0.07)";
  glareCtx.lineWidth = 7;
  glareCtx.beginPath();
  glareCtx.arc(256, 256, 247, 0, TAU);
  glareCtx.stroke();

  const glareTexture = new THREE.CanvasTexture(glareCanvas);
  glareTexture.colorSpace = THREE.SRGBColorSpace;
  const glare = new THREE.Mesh(
    new THREE.CircleGeometry(DIMENSIONS.crystalRadius * 0.995, 96),
    new THREE.MeshBasicMaterial({
      map: glareTexture,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  glare.name = "Crystal glare";
  glare.position.z = 0.376;
  glare.renderOrder = 9;
  group.add(glare);

  applyShadows(group, true, true);
  dial.castShadow = false;
  crystal.castShadow = false;
  glare.castShadow = false;
  group.userData.crystal = crystal;
  group.userData.glare = glare;
  group.userData.date = DATE;
  return group;
}
