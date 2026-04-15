import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "tools", "art-pipeline.config.json");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
let canvasApi = null;

const STYLE_PRESETS = {
  industrial: { mulR: 0.9, mulG: 0.86, mulB: 0.8, lift: -8, saturation: 0.9, contrast: 1.02 },
  clean: { mulR: 1.03, mulG: 1.07, mulB: 1.12, lift: 8, saturation: 1.08, contrast: 1.04 },
  stormy: { mulR: 0.75, mulG: 0.82, mulB: 0.95, lift: -18, saturation: 0.8, contrast: 1.08 },
};

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const sourceShipDir = path.resolve(ROOT, config.inputs.shipSlicesDir);
  const sourceSheetPath = path.resolve(ROOT, config.inputs.playerSheetPath);
  const outputRoot = path.resolve(ROOT, config.outputs.generatedRootDir);
  const styles = Array.isArray(config.styles) && config.styles.length > 0 ? config.styles : Object.keys(STYLE_PRESETS);

  const sliceFiles = await listSliceFiles(sourceShipDir, config.inputs.sliceFilePattern);
  if (sliceFiles.length === 0) {
    throw new Error(`No ship slices found in ${sourceShipDir}`);
  }

  await access(sourceSheetPath);
  if (!dryRun) {
    canvasApi = await tryLoadCanvasApi();
  }

  if (!dryRun) {
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(outputRoot, { recursive: true });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    source: {
      shipSlicesDir: relativeFromRoot(sourceShipDir),
      playerSheetPath: relativeFromRoot(sourceSheetPath),
      sliceCount: sliceFiles.length,
    },
    styles: [],
  };

  for (const styleName of styles) {
    const styleConfig = STYLE_PRESETS[styleName];
    if (!styleConfig) {
      throw new Error(`Unknown style '${styleName}' in config. Supported: ${Object.keys(STYLE_PRESETS).join(", ")}`);
    }

    const styleRoot = path.join(outputRoot, styleName);
    const styleShipDir = path.join(styleRoot, "ship");
    const styleSpritesDir = path.join(styleRoot, "sprites");
    const styleSheetPath = path.join(styleSpritesDir, "player_ship_stack.png");
    const generatedSlices = [];

    if (!dryRun) {
      await mkdir(styleShipDir, { recursive: true });
      await mkdir(styleSpritesDir, { recursive: true });
    }

    for (const sliceFile of sliceFiles) {
      const src = path.join(sourceShipDir, sliceFile);
      const out = path.join(styleShipDir, sliceFile);
      generatedSlices.push(relativeFromRoot(out));
      if (!dryRun) {
        if (canvasApi) {
          await recolorImageToFile(src, out, styleConfig);
        } else {
          await copyFile(src, out);
        }
      }
    }

    if (!dryRun) {
      if (canvasApi) {
        await recolorImageToFile(sourceSheetPath, styleSheetPath, styleConfig);
      } else {
        await copyFile(sourceSheetPath, styleSheetPath);
      }
      await writeFile(
        path.join(styleRoot, "manifest.json"),
        JSON.stringify(
          {
            style: styleName,
            generatedAt: new Date().toISOString(),
            source: {
              shipSlicesDir: relativeFromRoot(sourceShipDir),
              playerSheetPath: relativeFromRoot(sourceSheetPath),
            },
            outputs: {
              shipSlicesDir: relativeFromRoot(styleShipDir),
              playerSheetPath: relativeFromRoot(styleSheetPath),
              sliceCount: generatedSlices.length,
            },
            processingMode: canvasApi ? "recolor" : "copy",
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
    }

    report.styles.push({
      style: styleName,
      outputDir: relativeFromRoot(styleRoot),
      slices: generatedSlices.length,
      playerSheet: relativeFromRoot(styleSheetPath),
    });
  }

  if (!dryRun) {
    await writeFile(path.join(outputRoot, "pipeline-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  }

  process.stdout.write(`${dryRun ? "[dry-run] " : ""}Art pipeline complete.\n`);
  if (!dryRun && !canvasApi) {
    process.stdout.write(
      "Warning: native 'canvas' module was unavailable; assets were copied without style recolor transforms.\n",
    );
  }
  for (const style of report.styles) {
    process.stdout.write(`- ${style.style}: ${style.slices} slices -> ${style.outputDir}\n`);
  }
}

async function listSliceFiles(dir, pattern) {
  const files = await readdir(dir);
  const matcher = new RegExp(pattern);
  return files.filter((name) => matcher.test(name)).sort();
}

async function recolorImageToFile(sourcePath, targetPath, style) {
  if (!canvasApi) {
    throw new Error("Canvas API is not available.");
  }
  const image = await canvasApi.loadImage(sourcePath);
  const canvas = canvasApi.createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) {
      continue;
    }
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const grey = (r + g + b) / 3;
    r = grey + (r - grey) * style.saturation;
    g = grey + (g - grey) * style.saturation;
    b = grey + (b - grey) * style.saturation;

    r = ((r - 128) * style.contrast + 128) * style.mulR + style.lift;
    g = ((g - 128) * style.contrast + 128) * style.mulG + style.lift;
    b = ((b - 128) * style.contrast + 128) * style.mulB + style.lift;

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }

  ctx.putImageData(imageData, 0, 0);
  const buffer = canvas.toBuffer("image/png");
  await writeFile(targetPath, buffer);
}

function clamp255(value) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

function relativeFromRoot(absPath) {
  return path.relative(ROOT, absPath).replaceAll("\\", "/");
}

async function tryLoadCanvasApi() {
  try {
    const canvas = await import("canvas");
    return {
      createCanvas: canvas.createCanvas,
      loadImage: canvas.loadImage,
    };
  } catch {
    return null;
  }
}

main().catch((error) => {
  process.stderr.write(`Art pipeline failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
