/**
 * Artguru Image Scraper
 * ---------------------
 * Creator  : rhmt
 * Runtime  : NodeJS (MJS)
 * Base     : https://www.artguru.ai/
 *
 * note :
 * baru nyoba scrape cuy :v klo ada apa apa maklumi saja wkwkwk
 */

import fs from "node:fs/promises";
import process from "node:process";

const ENDPOINT_GENERATE =
  "https://api.picaapi.com/aigc/artguru/image/generate/v2";

const ENDPOINT_QUEUE =
  "https://api.picaapi.com/aigc/artguru/image/task-queue";

const DEFAULT_PROMPT =
  "Buat karakter tsb menjadi sangat imut berbadan fulll";

const DEFAULT_OPTIONS = {
  inputImage:
    "https://img.artguru.ai/image/aigc/web%26p%26e1e65804dd176efd38659d6840d53f88.webp?expires=1779139167",
  parentTaskId: "567d42f5-9b80-4c6b-bc0a-d3fa93aadd9e",
  originalFileName: "Elaina (3).jpeg",
  styleId: 1,
  width: "736",
  height: "736",
  aspectRatio: "1:1",
  numImagesPerReturn: 1,
};

const VTOKEN =
  "sYpb5/roPgHLIRmQd21VdRr37tXJN/6emDU6c8EDjwzJ/9bF/QR71i1vgo543+oSB0yLMso9aQzRp26HCgZ+3+8WUCy9UtWLnYTkOdqr4J6QruE4H/pEzVEeyr0RmhUjRU0mJ3GrrhYPxfmGGxhA1HTC0zq612b5DpDthgkL/Gs=";

const DTOKEN =
  "UHMd3xdHFc3/SMgIhw6fGELAYanMDXjrp0tbVag+Uvp7kbcSHgnIEwI169ObDg1LomwMNtmDHtC4vG07Cju4SCNCgMP7UTwEkh2sz7yqCRf//OGdRlj9Ityh9LvrdWJbhMUNkoVvM1Uv2RHrerS7EMWJVg7KYl86kMebZCMX8+w=";

const DISTINCT_ID =
  "19e32a7df5962-09463bb2be54fb8-b457458-373848-19e32a7df5b0";

const HEADERS = {
  pn: "web-artguru",
  lang: "en",
  vtoken: VTOKEN,
  dtoken: DTOKEN,
  "distinct-id": DISTINCT_ID,
  "gray-release-group": "release-1.26",
  "app-version": "1.26.0",
  from: "web",
  "content-type": "application/json",
  accept: "application/json, text/plain, */*",
  origin: "https://www.artguru.ai",
  referer: "https://www.artguru.ai/",
  "sec-ch-ua-platform": `"Android"`,
  "sec-ch-ua":
    `"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"`,
  "sec-ch-ua-mobile": "?1",
  "sec-fetch-site": "cross-site",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseJson(str, fallback = {}) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function buildMeta(options = {}) {
  const {
    parentTaskId = null,
    imageNumber = 1,
    styleId = 1,
    promptSrc = "user_input",
    positionSource = "ai_image_generator_workflow",
    originalFileName = "input-image.jpg",
  } = options;

  const meta = {
    image_number: String(imageNumber),
    style_name: String(styleId),
    prompt_src: String(promptSrc),
    position_source_start_from: String(positionSource),
    originalFileName: String(originalFileName),
  };

  if (parentTaskId) {
    meta.parent_task_id_string = String(parentTaskId);
  }

  return JSON.stringify(meta);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Response bukan JSON valid: ${text.slice(0, 500)}`);
  }

  return {
    ok: res.ok,
    status: res.status,
    data: json,
  };
}

function createPayload(prompt, options = {}) {
  const {
    inputImage = null,
    aspectRatio = "1:1",
    numImagesPerReturn = 1,
    styleId = 1,
    width = "736",
    height = "736",
    parentTaskId = null,
    imageNumber = 1,
    promptSrc = "user_input",
    positionSource = "ai_image_generator_workflow",
    originalFileName = "input-image.jpg",
    meta = null,
  } = options;

  return {
    prompt: String(prompt),
    aspectRatio: String(aspectRatio),
    numImagesPerReturn: Number(numImagesPerReturn),
    styleId: Number(styleId),
    meta:
      meta ||
      buildMeta({
        parentTaskId,
        imageNumber,
        styleId,
        promptSrc,
        positionSource,
        originalFileName,
      }),
    width: String(width),
    height: String(height),
    ...(inputImage ? { inputImage: String(inputImage) } : {}),
  };
}

function errorResult(message, extra = {}) {
  return {
    status: false,
    code: extra?.code || 500,
    creator: "rhmt",
    error: message,
    ...extra,
  };
}

function pendingResult(prompt, taskId, item) {
  const meta = parseJson(item?.meta || "{}");
  const queue = item?.asyncTaskQueueVO || {};

  return {
    status: true,
    code: 202,
    creator: "rhmt",
    prompt,
    taskId: taskId || item?.taskId || null,
    queueStatus: item?.queueStatus || "PENDING",
    wait: {
      rank: queue?.rank ?? null,
      waitTime: queue?.waitTime ?? null,
    },
    meta: {
      originalFileName: meta?.originalFileName || null,
      aspectRatio: meta?.aspect_ratio || null,
      inputWidth: meta?.input_width || null,
      inputHeight: meta?.input_height || null,
      parentTaskId: meta?.parent_task_id_string || null,
      imageNumber: meta?.image_number || null,
      styleName: meta?.style_name || null,
      promptSrc: meta?.prompt_src || null,
      positionSource: meta?.position_source_start_from || null,
    },
    message: "Task masih diproses",
  };
}

function successResult(prompt, item) {
  const meta = parseJson(item?.meta || "{}");

  return {
    status: true,
    code: 200,
    creator: "rhmt",
    prompt,
    taskId: item?.taskId || null,
    queueStatus: item?.queueStatus || "SUCCESS",
    processing: item?.queueCostTime ?? null,
    meta: {
      originalFileName: meta?.originalFileName || null,
      aspectRatio: meta?.aspect_ratio || null,
      inputWidth: meta?.input_width || null,
      inputHeight: meta?.input_height || null,
      parentTaskId: meta?.parent_task_id_string || null,
      imageNumber: meta?.image_number || null,
      styleName: meta?.style_name || null,
      promptSrc: meta?.prompt_src || null,
      positionSource: meta?.position_source_start_from || null,
      outputWidth: meta?.width || null,
      outputHeight: meta?.height || null,
    },
    total: item?.generateImage ? 1 : 0,
    results: item?.generateImage
      ? [
          {
            type: "image",
            url: item.generateImage,
            original: item.originalImage || null,
          },
        ]
      : [],
  };
}

async function generateTask(prompt, options = {}) {
  return await postJson(ENDPOINT_GENERATE, createPayload(prompt, options));
}

async function checkTask(taskId) {
  return await postJson(ENDPOINT_QUEUE, {
    taskIds: [String(taskId)],
  });
}

export default async function artguru(prompt = DEFAULT_PROMPT, options = {}) {
  try {
    if (!prompt || !String(prompt).trim()) {
      return errorResult("Prompt kosong", { code: 400 });
    }

    const cleanPrompt = String(prompt).trim();

    const finalOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    const first = await generateTask(cleanPrompt, finalOptions);

    if (!first.ok || first.data?.code !== 0) {
      return errorResult(first.data?.message || "Gagal membuat task", {
        code: first.status || 500,
        raw: first.data,
      });
    }

    const firstItem = Array.isArray(first.data?.data)
      ? first.data.data[0]
      : null;

    const taskId = firstItem?.taskId || null;

    if (!taskId) {
      return errorResult("Task ID tidak ditemukan", {
        code: 500,
        raw: first.data,
      });
    }

    if (options.returnPendingOnly === true) {
      return pendingResult(cleanPrompt, taskId, firstItem);
    }

    if (
      String(firstItem?.queueStatus || "").toUpperCase() === "SUCCESS" &&
      firstItem?.generateImage
    ) {
      return successResult(cleanPrompt, firstItem);
    }

    const maxAttempts = Number(options.maxAttempts || 25);
    const interval = Number(
      options.interval || firstItem?.asyncTaskQueueVO?.waitTime || 3000
    );

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(interval);

      const polled = await checkTask(taskId);

      if (!polled.ok || polled.data?.code !== 0) {
        return errorResult(polled.data?.message || "Gagal cek task queue", {
          code: polled.status || 500,
          taskId,
          raw: polled.data,
        });
      }

      const item = Array.isArray(polled.data?.data)
        ? polled.data.data[0]
        : null;

      if (!item) continue;

      const status = String(item?.queueStatus || "").toUpperCase();

      if (status === "SUCCESS" && item?.generateImage) {
        return successResult(cleanPrompt, item);
      }

      if (["FAIL", "FAILED", "ERROR", "CANCEL", "CANCELED"].includes(status)) {
        return errorResult(`Task gagal: ${status}`, {
          code: 500,
          taskId,
          raw: item,
        });
      }
    }

    return pendingResult(cleanPrompt, taskId, firstItem);
  } catch (err) {
    return errorResult(err.message || "Terjadi kesalahan");
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const save = process.argv.includes("--save");

  const args = process.argv
    .slice(2)
    .filter((arg) => arg !== "--save");

  const optionsArg = args.find((arg) => arg.trim().startsWith("{"));
  const promptArg = args.find((arg) => !arg.trim().startsWith("{"));

  const prompt = promptArg || DEFAULT_PROMPT;
  let options = {};

  if (optionsArg) {
    try {
      options = JSON.parse(optionsArg);
    } catch {
      console.error("Options JSON tidak valid");
      process.exit(1);
    }
  }

  const result = await artguru(prompt, options);

  console.log(JSON.stringify(result, null, 2));

  if (save) {
    await fs.writeFile(
      "artguru-result.json",
      JSON.stringify(result, null, 2),
      "utf8"
    );

    console.log("\nsaved => artguru-result.json");
  }
  }
