import { readFile, mkdir, writeFile } from "node:fs/promises";
import { launchBrowser } from "../test/helpers/browser.mjs";

const names = [
  "eevee",
  "pikachu",
  "rowlet",
  "sprigatito",
  "piplup",
  "jigglypuff",
  "togepi",
  "squirtle",
  "charizard",
];
const browser = await launchBrowser();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1344 },
    deviceScaleFactor: 1,
  });
  const images = await Promise.all(
    names.map(
      async (name) =>
        `<figure><img src="data:image/png;base64,${(await readFile(`../pokemon/previews/${name}.png`)).toString("base64")}"><figcaption>${name}</figcaption></figure>`,
    ),
  );
  await page.setContent(
    `<style>body{margin:0;background:#f4f3ee;color:#263a39;font:22px system-ui}header{height:72px;box-sizing:border-box;padding:20px 32px;font-weight:600;letter-spacing:1px}main{display:grid;grid-template-columns:repeat(3,400px)}figure{margin:0;text-align:center;height:424px}img{width:390px;height:390px;object-fit:contain;border-radius:10px}figcaption{text-transform:capitalize;font-weight:600}</style><header>POKÉMON · BLENDER CHARACTER ROSTER</header><main>${images.join("")}</main>`,
  );
  await page.evaluate(async () => {
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.screenshot({ path: "../pokemon/pokemon-roster-preview.png" });
  await mkdir("public/models/pokemon/previews", { recursive: true });
  const thumbs = await page.evaluate(() =>
    [...document.images].map((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 160;
      canvas.getContext("2d").drawImage(image, 0, 0, 160, 160);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
  );
  await Promise.all(
    thumbs.map((data, index) =>
      writeFile(
        `public/models/pokemon/previews/${names[index]}.png`,
        Buffer.from(data, "base64"),
      ),
    ),
  );
  console.log("Saved roster preview and nine wardrobe thumbnails.");
} finally {
  await browser.close();
}
