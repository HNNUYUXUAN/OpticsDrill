import { mkdir, writeFile } from "node:fs/promises";
const root = new URL("../public/figures/", import.meta.url);
await mkdir(root, { recursive: true });
const line = (x1, y1, x2, y2, color = "#31566e", dash = "") =>
  '<line x1="' +
  x1 +
  '" y1="' +
  y1 +
  '" x2="' +
  x2 +
  '" y2="' +
  y2 +
  '" stroke="' +
  color +
  '" stroke-width="2" ' +
  (dash ? 'stroke-dasharray="' + dash + '"' : "") +
  "/>";
const text = (x, y, t) =>
  '<text x="' +
  x +
  '" y="' +
  y +
  '" font-size="17" fill="#202428">' +
  t +
  "</text>";
const wrap = (title, body, note = "Schematic; not to scale") =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 360" role="img" aria-label="' +
  title +
  '"><rect width="760" height="360" fill="white"/><g font-family="Arial,sans-serif">' +
  text(26, 30, title) +
  body +
  text(26, 340, note) +
  "</g></svg>";
for (const [name, source, virtual, focal, screen] of [
  ["split-interference", "25 cm", "50 cm", "f = 50 cm", "50 cm"],
  ["split-images", "5 cm", "10 cm", "f = 10 cm", ""],
]) {
  let b =
    line(55, 180, 710, 180, "#aaa", "6 5") +
    line(380, 70, 380, 290) +
    line(380, 70, 370, 85) +
    line(380, 70, 390, 85) +
    line(380, 290, 370, 275) +
    line(380, 290, 390, 275);
  for (const y of [140, 220])
    b +=
      '<circle cx="140" cy="' +
      y +
      '" r="5" fill="#31566e"/>' +
      line(140, y, 380, y, "#8ba1af", "5 5");
  b +=
    '<circle cx="260" cy="180" r="5" fill="#202428"/>' +
    text(242, 210, "S") +
    text(86, 120, "Virtual images") +
    text(67, 265, "separation = 1 cm") +
    text(196, 110, source) +
    text(145, 300, virtual) +
    text(390, 65, focal);
  if (screen)
    b +=
      line(650, 65, 650, 295, "#202428") +
      text(506, 110, screen) +
      text(625, 315, "Screen");
  await writeFile(new URL(name + ".svg", root), wrap("Split lens geometry", b));
}
await writeFile(
  new URL("plate.svg", root),
  wrap(
    "Parallel plate: paraxial apparent shift",
    '<rect x="280" y="70" width="180" height="200" fill="#edf3f6" stroke="#31566e"/>' +
      line(70, 180, 680, 180, "#aaa", "5 5") +
      text(325, 140, "n = 1.5") +
      text(313, 230, "d = 30 cm") +
      text(85, 110, "Object") +
      text(495, 110, "Observer") +
      text(74, 295, "Apparent displacement = d(1 - 1/n) = 10 cm"),
  ),
);
let levels = "";
for (const [n, e] of [
  [1, -13.6],
  [2, -3.4],
  [3, -13.6 / 9],
  [4, -0.85],
]) {
  const y = 66 - e * 15;
  const labelY = n === 4 ? 55 : n === 3 ? 94 : y + 5;
  levels +=
    line(200, y, 570, y) +
    line(570, y, 588, labelY - 5, "#aaa") +
    text(100, labelY, "n = " + n) +
    text(590, labelY, e.toFixed(3) + " eV");
}
levels +=
  line(200, 66, 570, 66, "#aaa", "5 5") +
  text(210, 59, "0 eV") +
  text(235, 300, "E_n = -13.6 / n^2 eV");
await writeFile(
  new URL("hydrogen-levels.svg", root),
  wrap(
    "Hydrogen: first four energy levels",
    levels,
    "Energy positions to scale; labels offset",
  ),
);
const path = [];
for (let i = 0; i <= 600; i++) {
  let b = (i - 300) / 30;
  let z = b === 0 ? 1 : (Math.sin(b) / b) ** 2;
  path.push((i ? "L" : "M") + (80 + i) + " " + (290 - 220 * z));
}
await writeFile(
  new URL("single-slit.svg", root),
  wrap(
    "Single-slit diffraction: normalized intensity",
    line(80, 290, 700, 290, "#aaa") +
      line(80, 55, 80, 290, "#aaa") +
      '<path d="' +
      path.join(" ") +
      '" stroke="#31566e" stroke-width="2" fill="none"/>' +
      text(420, 320, "beta = pi b sin(theta) / lambda") +
      text(90, 70, "I / I_center"),
  ),
);
console.log("Generated 5 scientific SVG figures");
