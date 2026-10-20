import * as THREE from "three";

export const TAU = Math.PI * 2;

export function lathe(points, segments = 128) {
  return new THREE.LatheGeometry(
    points.map(([r, z]) => new THREE.Vector2(r, z)),
    segments
  );
}

export function latheMesh(points, material, { segments = 128, cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(lathe(points, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

export function roundedRectShape(width, height, radius) {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

export function roundedRectPath(width, height, radius) {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const path = new THREE.Path();
  path.moveTo(-w + r, -h);
  path.lineTo(w - r, -h);
  path.quadraticCurveTo(w, -h, w, -h + r);
  path.lineTo(w, h - r);
  path.quadraticCurveTo(w, h, w - r, h);
  path.lineTo(-w + r, h);
  path.quadraticCurveTo(-w, h, -w, h - r);
  path.lineTo(-w, -h + r);
  path.quadraticCurveTo(-w, -h, -w + r, -h);
  return path;
}

export function roundedRectGeo(width, height, radius, depth = 0.02, bevel = 0.004, material) {
  const shape = roundedRectShape(width, height, radius);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSegments: 4,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 16,
    steps: 1,
  });
  geometry.center();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function circleDisc(radius, material, segments = 96) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, segments), material);
  mesh.receiveShadow = true;
  return mesh;
}

export function setShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.traverse?.((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return mesh;
}

export function applyShadows(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return object;
}

export function polar(angle, radius, z = 0) {
  return new THREE.Vector3(Math.sin(angle) * radius, Math.cos(angle) * radius, z);
}

export function makeColor(hex) {
  return new THREE.Color(hex);
}

export function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* A smooth superellipse cross-section for the strap. n=4.4 keeps the face
   flat enough to read as a belt, with softly rounded edges. */
export function superellipsePoint(theta, halfWidth, halfThickness, n = 4.4) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * halfWidth;
  const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * halfThickness;
  return [x, y];
}

/* Convert a sampled 2D outline into a Shape without self-intersections. */
export function shapeFromPoints(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();
  return shape;
}
