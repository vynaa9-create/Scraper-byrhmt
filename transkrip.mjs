/**
 * Video Transcriber Scraper
 * -------------------------
 * Creator : rhmt
 * Base    : https://videotranscriber.ai/
 * Desc    : Transcribe video dari link
 */

import fs from "node:fs/promises";
import crypto from "node:crypto";
import process from "node:process";

const ENDPOINT =
  "https://api.proactor.ai:7788/v1/tourists/files/transcription";

const DEFAULT_URL = "https://vt.tiktok.com/ZSxAQwojp/";
const DEFAULT_LANG = "en";

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "content-type": "application/json",
  origin: "https://videotranscriber.ai",
  referer: "https://videotranscriber.ai/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
};

function makeTrackId() {
  return `${crypto.randomUUID()}_${Date.now()}`;
}

function msToTime(ms = 0) {
  const total = Math.floor(Number(ms) / 1000);
  const minute = Math.floor(total / 60);
  const second = total % 60;

  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function joinTranscript(items = []) {
  return items
    .map((item) => item?.text || "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanResult(input, json) {
  const data = Array.isArray(json?.data) ? json.data : [];

  if (json?.code !== 200 || data.length === 0) {
    return {
      status: false,
      code: json?.code || 500,
      creator: "rhmt",
      input,
      error: json?.msg || json?.message || "Transcript tidak ditemukan",
      raw: json,
    };
  }

  const title =
    data.find((item) => item?.videoTitle)?.videoTitle || "No title";

  const segments = data.map((item, index) => ({
    index: index + 1,
    startMs: item?.duration ?? null,
    start: msToTime(item?.duration || 0),
    text: item?.text || "",
  }));

  return {
    status: true,
    code: 200,
    creator: "rhmt",
    input,
    title,
    total: segments.length,
    transcript: joinTranscript(data),
    segments,
  };
}

async function transcriber(url = DEFAULT_URL, options = {}) {
  try {
    if (!url || !/^https?:\/\//i.test(String(url))) {
      return {
        status: false,
        code: 400,
        creator: "rhmt",
        error: "URL kosong / tidak valid",
      };
    }

    const input = String(url).trim();

    const body = {
      track_id: options.track_id || makeTrackId(),
      fileUrl: input,
      language: options.language || DEFAULT_LANG,
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
    });

    const text = await res.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        status: false,
        code: res.status,
        creator: "rhmt",
        input,
        error: "Response bukan JSON",
        raw_preview: text.slice(0, 1000),
      };
    }

    return cleanResult(input, json);
  } catch (err) {
    return {
      status: false,
      code: 500,
      creator: "rhmt",
      error: err.message || "Terjadi kesalahan",
    };
  }
}

export { transcriber };
export default transcriber;

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const save = process.argv.includes("--save");

  const args = process.argv
    .slice(2)
    .filter((arg) => arg !== "--save");

  const optionsArg = args.find((arg) => arg.trim().startsWith("{"));
  const urlArg = args.find((arg) => !arg.trim().startsWith("{"));

  const url = urlArg || DEFAULT_URL;
  let options = {};

  if (optionsArg) {
    try {
      options = JSON.parse(optionsArg);
    } catch {
      console.error("Options JSON tidak valid");
      process.exit(1);
    }
  }

  const result = await transcriber(url, options);

  console.log(JSON.stringify(result, null, 2));

  if (save) {
    await fs.writeFile(
      "transcriber-result.json",
      JSON.stringify(result, null, 2),
      "utf8"
    );

    console.log("\nsaved => transcriber-result.json");
  }
}