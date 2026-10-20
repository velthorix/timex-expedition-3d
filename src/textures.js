import * as THREE from "three";

/* ——————————————————————————————————————————————————————————————
   Procedural texture atelier
   All artwork is drawn locally on canvas so the finished object is
   self-contained and every mark stays crisp under magnification.
—————————————————————————————————————————————————————————————— */

const TAU = Math.PI * 2;

function makeCanvas(width, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function configureTexture(texture, renderer, { srgb = false, aniso = 8 } = {}) {
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(aniso, renderer?.capabilities?.getMaxAnisotropy?.() || 8);
  texture.needsUpdate = true;
  return texture;
}

function canvasTexture(canvas, renderer, options = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  return configureTexture(texture, renderer, options);
}

/* Small deterministic random number generator so renders are repeatable. */
function rng(seed = 918273) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed = 0) {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, octaves = 4, seed = 0) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise(x * frequency, y * frequency, seed + i * 11);
    total += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value / total;
}

/* Text with reliable letter spacing on every browser. */
function spacedText(ctx, text, x, y, tracking = 0) {
  if (!tracking) {
    ctx.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (chars.length - 1);
  let cursor = x - total / 2;
  ctx.textAlign = "left";
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[index] + tracking;
  });
  ctx.textAlign = "center";
}

/* —————————————————————————————— Leather */

export function createLeatherTextures(renderer) {
  const random = rng(73921);
  const H = 512;

  // 1. A fine height field, later converted into a tangent-space normal map.
  const heightCanvas = makeCanvas(H);
  const heightCtx = heightCanvas.getContext("2d");
  const heightImage = heightCtx.createImageData(H, H);
  const heightData = heightImage.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < H; x++) {
      const nx = x / H;
      const ny = y / H;
      const broad = fbm(nx * 10.5, ny * 10.5, 4, 4);
      const medium = fbm(nx * 29 + 10, ny * 29 + 3, 3, 8);
      const fine = fbm(nx * 83 + 4, ny * 83 + 8, 2, 13);
      const grain = broad * 0.5 + medium * 0.34 + fine * 0.16;
      const value = 76 + grain * 138;
      const index = (y * H + x) * 4;
      heightData[index] = value;
      heightData[index + 1] = value;
      heightData[index + 2] = value;
      heightData[index + 3] = 255;
    }
  }
  heightCtx.putImageData(heightImage, 0, 0);

  // Pores add the irregular little valleys that make leather read as hide.
  for (let i = 0; i < 3600; i++) {
    const x = random() * H;
    const y = random() * H;
    const radius = 0.35 + random() * 1.9;
    const stretch = 0.55 + random() * 1.9;
    heightCtx.save();
    heightCtx.translate(x, y);
    heightCtx.rotate(random() * TAU);
    const shade = random() > 0.25 ? 34 + Math.floor(random() * 28) : 184 + Math.floor(random() * 32);
    heightCtx.fillStyle = `rgba(${shade},${shade},${shade},${0.13 + random() * 0.28})`;
    heightCtx.beginPath();
    heightCtx.ellipse(0, 0, radius * stretch, radius, 0, 0, TAU);
    heightCtx.fill();
    heightCtx.restore();
  }

  // Gentle creases, mostly across the strap.
  heightCtx.lineCap = "round";
  for (let i = 0; i < 34; i++) {
    const x = random() * H;
    const y = random() * H;
    const length = 24 + random() * 88;
    const bend = (random() - 0.5) * 50;
    heightCtx.strokeStyle = `rgba(50,50,50,${0.08 + random() * 0.16})`;
    heightCtx.lineWidth = 0.5 + random() * 1.3;
    heightCtx.beginPath();
    heightCtx.moveTo(x, y);
    heightCtx.quadraticCurveTo(x + length * 0.45, y + bend, x + length, y + bend * 0.35);
    heightCtx.stroke();
  }

  // 2. Normal map from the height field.
  const normalCanvas = makeCanvas(H);
  const normalCtx = normalCanvas.getContext("2d");
  const normalImage = normalCtx.createImageData(H, H);
  const normalData = normalImage.data;
  const source = heightCtx.getImageData(0, 0, H, H).data;
  const strength = 2.4;

  const sample = (x, y) => {
    const xx = ((x % H) + H) % H;
    const yy = ((y % H) + H) % H;
    return source[(yy * H + xx) * 4] / 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < H; x++) {
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * strength;
      const dy = (sample(x, y - 1) - sample(x, y + 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const index = (y * H + x) * 4;
      normalData[index] = ((dx / length) * 0.5 + 0.5) * 255;
      normalData[index + 1] = ((dy / length) * 0.5 + 0.5) * 255;
      normalData[index + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      normalData[index + 3] = 255;
    }
  }
  normalCtx.putImageData(normalImage, 0, 0);

  // 3. A tactile, near-neutral albedo map. Kept neutral so the leather
  //    selector can tint it without the underlying tan fighting the choice.
  //    The tone is even rather than graded, which keeps the long strap free of
  //    banding when the texture repeats across the curved surface.
  const colorCanvas = makeCanvas(1024);
  const colorCtx = colorCanvas.getContext("2d");
  colorCtx.fillStyle = "#b6afa4";
  colorCtx.fillRect(0, 0, 1024, 1024);

  // Broad uneven colour variation, like oiled hide, kept very soft.
  for (let i = 0; i < 150; i++) {
    const x = random() * 1024;
    const y = random() * 1024;
    const r = 18 + random() * 90;
    const dark = random() > 0.45;
    const grad = colorCtx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark ? "rgba(42,36,30,0.035)" : "rgba(255,250,240,0.03)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    colorCtx.fillStyle = grad;
    colorCtx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // A fine, even speck field carries the hide grain without large-scale
  // luminance changes.
  const grainImage = colorCtx.getImageData(0, 0, 1024, 1024);
  const grainData = grainImage.data;
  for (let i = 0; i < grainData.length; i += 4) {
    const noise = (random() - 0.5) * 7;
    grainData[i] = THREE.MathUtils.clamp(grainData[i] + noise, 0, 255);
    grainData[i + 1] = THREE.MathUtils.clamp(grainData[i + 1] + noise, 0, 255);
    grainData[i + 2] = THREE.MathUtils.clamp(grainData[i + 2] + noise, 0, 255);
  }
  colorCtx.putImageData(grainImage, 0, 0);

  // Shallow cracks and scars.
  for (let i = 0; i < 46; i++) {
    const x = random() * 1024;
    const y = random() * 1024;
    const length = 25 + random() * 130;
    const bend = (random() - 0.5) * 54;
    colorCtx.strokeStyle = `rgba(45,37,29,${0.04 + random() * 0.08})`;
    colorCtx.lineWidth = 0.55 + random() * 1.1;
    colorCtx.beginPath();
    colorCtx.moveTo(x, y);
    colorCtx.quadraticCurveTo(x + length * 0.55, y + bend, x + length, y + bend * 0.32);
    colorCtx.stroke();
  }

  // Pores with a tiny upper highlight. The speck field is deliberately
  // irregular rather than a repeating dot pattern.
  for (let i = 0; i < 3900; i++) {
    const x = random() * 1024;
    const y = random() * 1024;
    const radius = 0.35 + random() * 1.55;
    colorCtx.fillStyle = `rgba(40,32,25,${0.025 + random() * 0.09})`;
    colorCtx.beginPath();
    colorCtx.ellipse(x, y, radius * (0.8 + random()), radius, random() * TAU, 0, TAU);
    colorCtx.fill();
    if (random() > 0.63) {
      colorCtx.fillStyle = `rgba(255,248,236,${0.025 + random() * 0.045})`;
      colorCtx.beginPath();
      colorCtx.ellipse(x - 0.5, y - 0.7, radius * 0.7, radius * 0.45, 0, 0, TAU);
      colorCtx.fill();
    }
  }

  // 4. Roughness: polished patches from handling, matte pores everywhere else.
  const roughnessCanvas = makeCanvas(512);
  const roughnessCtx = roughnessCanvas.getContext("2d");
  const roughImage = roughnessCtx.createImageData(512, 512);
  const roughData = roughImage.data;

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const nx = x / 512;
      const ny = y / 512;
      const patch = fbm(nx * 4.5 + 5, ny * 4.5 + 8, 3, 23);
      const grain = fbm(nx * 38, ny * 38, 2, 6);
      const value = 164 + patch * 34 + grain * 28;
      const index = (y * 512 + x) * 4;
      roughData[index] = value;
      roughData[index + 1] = value;
      roughData[index + 2] = value;
      roughData[index + 3] = 255;
    }
  }
  roughnessCtx.putImageData(roughImage, 0, 0);
  roughnessCtx.save();
  roughnessCtx.globalCompositeOperation = "soft-light";
  roughnessCtx.globalAlpha = 0.6;
  roughnessCtx.drawImage(heightCanvas, 0, 0, 512, 512);
  roughnessCtx.restore();

  const map = canvasTexture(colorCanvas, renderer, { srgb: true });
  const normalMap = canvasTexture(normalCanvas, renderer, { srgb: false });
  const roughnessMap = canvasTexture(roughnessCanvas, renderer, { srgb: false });

  map.repeat.set(1, 1);
  normalMap.repeat.set(1, 1);
  roughnessMap.repeat.set(1, 1);

  return { map, normalMap, roughnessMap };
}

/* —————————————————————————————— Dial print */

export function createDialTexture(renderer) {
  const SIZE = 2048;
  const CENTER = SIZE / 2;
  const SCALE = 1000; // pixels per scene unit
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext("2d");
  const random = rng(44022);

  const px = (value) => value * SCALE;
  const xAt = (angle, radius) => CENTER + Math.sin(angle) * px(radius);
  const yAt = (angle, radius) => CENTER - Math.cos(angle) * px(radius);

  // Warm ivory ground with a soft, almost imperceptible dome of light.
  const base = ctx.createRadialGradient(
    CENTER - SCALE * 0.12,
    CENTER - SCALE * 0.16,
    SCALE * 0.1,
    CENTER,
    CENTER,
    SCALE * 0.96
  );
  base.addColorStop(0, "#faf7ee");
  base.addColorStop(0.37, "#f7f2e7");
  base.addColorStop(0.77, "#f1eadc");
  base.addColorStop(1, "#e3d7c4");
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, SCALE * 0.965, 0, TAU);
  ctx.fill();

  // Subtle fibres in the paper-lacquer surface.
  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, px(0.92), 0, TAU);
  ctx.clip();
  for (let i = 0; i < 2600; i++) {
    const angle = random() * TAU;
    const radius = Math.sqrt(random()) * px(0.91);
    const x = CENTER + Math.cos(angle) * radius;
    const y = CENTER + Math.sin(angle) * radius;
    const len = 1 + random() * 5;
    ctx.strokeStyle = random() > 0.55 ? "rgba(105,82,51,0.028)" : "rgba(255,255,255,0.085)";
    ctx.lineWidth = 0.6 + random() * 0.75;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * len, y + (random() - 0.5) * len);
    ctx.stroke();
  }
  ctx.restore();

  // Faint edge shading makes the dial sit into the metal housing.
  const edge = ctx.createRadialGradient(CENTER, CENTER, px(0.78), CENTER, CENTER, px(0.97));
  edge.addColorStop(0, "rgba(44,31,18,0)");
  edge.addColorStop(1, "rgba(44,31,18,0.17)");
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, SCALE * 0.965, 0, TAU);
  ctx.fill();

  // — Minute track
  ctx.save();
  ctx.strokeStyle = "#100f0b";
  ctx.lineCap = "butt";
  for (let index = 0; index < 60; index++) {
    const angle = (index / 60) * TAU;
    const major = index % 5 === 0;
    const inner = major ? 0.796 : 0.836;
    const outer = 0.884;
    ctx.lineWidth = major ? 7.8 : 4.4;
    ctx.globalAlpha = major ? 1 : 0.92;
    ctx.beginPath();
    ctx.moveTo(xAt(angle, inner), yAt(angle, inner));
    ctx.lineTo(xAt(angle, outer), yAt(angle, outer));
    ctx.stroke();
  }
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 3.1;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, px(0.878), 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, px(0.899), 0, TAU);
  ctx.stroke();
  ctx.restore();

  // — 24-hour scale in expedition red
  ctx.save();
  ctx.fillStyle = "#9c1f18";
  ctx.font = '700 64px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let hour = 1; hour <= 11; hour++) {
    if (hour === 3) continue; // date aperture
    const angle = (hour / 12) * TAU;
    const radius = hour === 1 || hour === 11 ? 0.514 : 0.507;
    ctx.globalAlpha = 1;
    ctx.fillText(String(hour + 12), xAt(angle, radius), yAt(angle, radius));
  }
  ctx.restore();

  // — Brand lockup
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0f0d0a";
  ctx.font = '700 70px "Helvetica Neue", Arial, sans-serif';
  ctx.globalAlpha = 1;
  spacedText(ctx, "TIMEX", CENTER, CENTER - px(0.582), 6.0);

  ctx.font = '700 42px "Helvetica Neue", Arial, sans-serif';
  spacedText(ctx, "EXPEDITION", CENTER - 1, CENTER - px(0.505), 9.4);
  ctx.restore();

  // — Lower copy
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#12100c";
  ctx.font = '700 44px "Helvetica Neue", Arial, sans-serif';
  spacedText(ctx, "INDIGLO", CENTER, CENTER + px(0.331), 4.2);

  ctx.fillStyle = "#262119";
  ctx.font = '700 34px "Helvetica Neue", Arial, sans-serif';
  spacedText(ctx, "WR 50M", CENTER, CENTER + px(0.399), 5.8);

  // A tiny red-haematite accent echoing the seconds hand.
  ctx.fillStyle = "#982018";
  ctx.fillRect(CENTER - px(0.09), CENTER + px(0.442), px(0.18), 3);
  ctx.restore();

  // — Very small manufacturing marks, placed with restraint.
  ctx.save();
  ctx.fillStyle = "rgba(42,35,26,0.7)";
  ctx.font = '600 22px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("QUARTZ", CENTER, CENTER + px(0.584));
  ctx.restore();

  const texture = canvasTexture(canvas, renderer, { srgb: true, aniso: 16 });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createDialBumpTexture(renderer) {
  const SIZE = 512;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext("2d");
  const random = rng(5521);
  const image = ctx.createImageData(SIZE, SIZE);
  const data = image.data;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = fbm((x / SIZE) * 28, (y / SIZE) * 28, 3, 81);
      const value = 138 + n * 42;
      const i = (y * SIZE + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  for (let i = 0; i < 2300; i++) {
    const shade = random() > 0.5 ? 128 : 184;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.07)`;
    ctx.beginPath();
    ctx.arc(random() * SIZE, random() * SIZE, 0.4 + random() * 1.3, 0, TAU);
    ctx.fill();
  }

  const texture = canvasTexture(canvas, renderer, { srgb: false });
  texture.repeat.set(5, 5);
  return texture;
}

/* —————————————————————————————— Date disc */

export function createDateTexture(renderer) {
  const W = 512;
  const H = 384;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#f4efdf");
  grad.addColorStop(0.55, "#fbf8ef");
  grad.addColorStop(1, "#f0eadb");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const shade = ctx.createLinearGradient(0, 0, 0, 95);
  shade.addColorStop(0, "rgba(53,42,26,0.22)");
  shade.addColorStop(1, "rgba(53,42,26,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, 95);

  ctx.fillStyle = "rgba(97,77,49,0.06)";
  for (let i = 0; i < 100; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  ctx.fillStyle = "#1d1b17";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '600 205px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("15", W / 2, H / 2 + 15);

  const texture = canvasTexture(canvas, renderer, { srgb: true, aniso: 8 });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/* —————————————————————————————— Expedition emblem */

export function createEmblemTexture(renderer, { color = "#342117", opacity = 1 } = {}) {
  const SIZE = 512;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext("2d");
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Outer oval
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 204, 121, 0, 0, TAU);
  ctx.stroke();

  // Inked brand mark: an E formed from a wing and three strokes.
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(cx + 62, cy - 69);
  ctx.lineTo(cx + 62, cy + 69);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + 54, cy - 66);
  ctx.lineTo(cx - 108, cy - 66);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 54, cy);
  ctx.lineTo(cx - 49, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 54, cy + 66);
  ctx.lineTo(cx - 108, cy + 66);
  ctx.stroke();

  // Wing tips and a negative-space slash borrowed from the field watch mark.
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 108, cy - 66);
  ctx.lineTo(cx - 166, cy - 46);
  ctx.lineTo(cx - 123, cy - 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 168, cy + 29);
  ctx.lineTo(cx - 123, cy + 18);
  ctx.lineTo(cx - 166, cy + 46);
  ctx.stroke();

  const slash = ctx.createLinearGradient(cx - 60, cy + 45, cx + 20, cy - 35);
  slash.addColorStop(0, "rgba(0,0,0,0)");
  slash.addColorStop(0.5, color);
  slash.addColorStop(1, "rgba(0,0,0,0)");
  ctx.strokeStyle = slash;
  ctx.globalAlpha = opacity * 0.46;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(cx - 72, cy + 69);
  ctx.lineTo(cx + 15, cy - 68);
  ctx.stroke();

  // Slight embossed lip. A lighter offset line gives the eye a pressed edge.
  ctx.globalAlpha = opacity * 0.24;
  ctx.strokeStyle = "#f1d6b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx + 1, cy + 4, 205, 122, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();

  const texture = canvasTexture(canvas, renderer, { srgb: true, aniso: 8 });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/* —————————————————————————————— Engraved case back */

export function createCasebackTexture(renderer) {
  const SIZE = 1024;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext("2d");
  const c = SIZE / 2;

  ctx.clearRect(0, 0, SIZE, SIZE);

  // Concentric machined circles.
  ctx.strokeStyle = "rgba(43,39,32,0.72)";
  ctx.lineWidth = 3;
  [410, 392, 310, 210, 120].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, TAU);
    ctx.stroke();
  });

  ctx.strokeStyle = "rgba(50,44,36,0.48)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(angle) * 415, c + Math.sin(angle) * 415);
    ctx.lineTo(c + Math.cos(angle) * 435, c + Math.sin(angle) * 435);
    ctx.stroke();
  }

  // Engraved copy. A pale offset underneath simulates a cut bevel.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(250,245,235,0.4)";
  ctx.font = '700 86px "Helvetica Neue", Arial, sans-serif';
  spacedText(ctx, "TIMEX", c, c - 44 + 3, 6);
  ctx.fillStyle = "rgba(31,28,23,0.94)";
  spacedText(ctx, "TIMEX", c, c - 44, 6);

  ctx.font = '600 31px "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = "rgba(38,34,28,0.86)";
  spacedText(ctx, "EXPEDITION", c, c + 40, 7);

  ctx.font = '600 23px "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = "rgba(45,40,33,0.8)";
  spacedText(ctx, "STAINLESS STEEL BACK", c, c + 190, 4.6);
  spacedText(ctx, "WATER RESISTANT 50M", c, c - 202, 4.2);

  ctx.font = '500 20px "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = "rgba(45,40,33,0.62)";
  spacedText(ctx, "MINERAL CRYSTAL  ·  QUARTZ", c, c + 116, 3.4);

  // A restrained service mark.
  ctx.strokeStyle = "rgba(45,40,33,0.55)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(c, c + 54, 58, 31, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(45,40,33,0.6)";
  ctx.font = '600 28px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("E", c, c + 55);

  const texture = canvasTexture(canvas, renderer, { srgb: true, aniso: 8 });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/* —————————————————————————————— Brushed steel maps */

export function createCasebackMetalMaps(renderer) {
  const SIZE = 1024;
  const c = SIZE / 2;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext("2d");
  const random = rng(8421);

  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Concentric lathe marks. Short arcs at many radii read as a circular
  // brushed finish rather than a flat mirror.
  for (let i = 0; i < 2400; i++) {
    const radius = 24 + Math.sqrt(random()) * 488;
    const start = random() * TAU;
    const length = 0.03 + random() * 0.62;
    const value = 92 + Math.floor(random() * 104);
    ctx.strokeStyle = `rgba(${value},${value},${value},${0.06 + random() * 0.22})`;
    ctx.lineWidth = 0.35 + random() * 2.4;
    ctx.beginPath();
    ctx.arc(c, c, radius, start, start + length);
    ctx.stroke();
  }

  // A few long, faint circles suggest the tool path.
  for (let i = 0; i < 26; i++) {
    const radius = 60 + random() * 440;
    ctx.strokeStyle = `rgba(${120 + random() * 60},${120 + random() * 60},${120 + random() * 60},0.06)`;
    ctx.lineWidth = 0.6 + random() * 1.2;
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, TAU);
    ctx.stroke();
  }

  const texture = canvasTexture(canvas, renderer, { srgb: false, aniso: 8 });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return { map: texture };
}

export function createMetalMaps(renderer, { radial = false } = {}) {
  const W = 1024;
  const H = 512;
  const random = rng(radial ? 521 : 720);

  const coarse = makeCanvas(W, H);
  const cctx = coarse.getContext("2d");
  cctx.fillStyle = "#888888";
  cctx.fillRect(0, 0, W, H);

  // Long, whisper-thin directional grain. Horizontal streaks become
  // concentric brushing once wrapped around a lathed bezel.
  for (let i = 0; i < 2600; i++) {
    const value = 98 + Math.floor(random() * 95);
    const alpha = 0.035 + random() * 0.11;
    cctx.strokeStyle = `rgba(${value},${value},${value},${alpha})`;
    cctx.lineWidth = 0.35 + random() * 1.25;
    cctx.beginPath();
    if (radial) {
      const y = random() * H;
      const x = random() * W;
      const length = 90 + random() * 520;
      cctx.moveTo(x, y);
      cctx.bezierCurveTo(x + length * 0.33, y + (random() - 0.5) * 1.4, x + length * 0.66, y + (random() - 0.5) * 1.4, x + length, y);
    } else {
      const x = random() * W;
      const y = random() * H;
      const length = 65 + random() * 380;
      cctx.moveTo(x, y);
      cctx.bezierCurveTo(x + (random() - 0.5) * 1.2, y + length * 0.33, x + (random() - 0.5) * 1.2, y + length * 0.66, x, y + length);
    }
    cctx.stroke();
  }

  // Sparse haze makes the reflection break up just enough to feel real.
  const data = cctx.getImageData(0, 0, W, H);
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const n = (random() - 0.5) * 8;
    pixels[i] = Math.max(0, Math.min(255, pixels[i] + n));
    pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + n));
    pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + n));
  }
  cctx.putImageData(data, 0, 0);

  const roughness = canvasTexture(coarse, renderer, { srgb: false, aniso: 8 });
  roughness.colorSpace = THREE.NoColorSpace;
  roughness.repeat.set(radial ? 2 : 2.4, radial ? 2 : 2.4);

  const bump = canvasTexture(coarse, renderer, { srgb: false, aniso: 8 });
  bump.colorSpace = THREE.NoColorSpace;
  bump.repeat.copy(roughness.repeat);

  return { roughness, bump };
}

/* —————————————————————————————— Fine printed booklet paper */

export function createPaperTexture(renderer) {
  const SIZE = 512;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext("2d");
  const random = rng(991);
  ctx.fillStyle = "#d8d0c1";
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 8000; i++) {
    const shade = 80 + Math.floor(random() * 100);
    ctx.fillStyle = `rgba(${shade},${shade - 4},${shade - 12},${0.015 + random() * 0.04})`;
    ctx.fillRect(random() * SIZE, random() * SIZE, 0.6 + random() * 1.6, 0.6 + random() * 1.6);
  }
  const texture = canvasTexture(canvas, renderer, { srgb: true });
  texture.repeat.set(4, 4);
  return texture;
}
