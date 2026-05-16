/**
 * Instagram Downloader
 * --------------------
 * Creator  : rhmt
 * Runtime  : NodeJS (MJS)
 * Base     : https://sssinstagram.com/
 * Raw      : https://raw.githubusercontent.com/vynaa9-create/Scraper-byrhmt/refs/heads/main/igdl.mjs
 *
 * Features :
 * - Fast response
 * - Clean parser
 * - Reel/Post support
 * - Ready for bot & web
 */

import fs from "node:fs/promises";

const API = "https://api-wh.sssinstagram.com/api/convert";

// Buat test di bot tele yg ga support argumen
const DEMO_URL = "https://www.instagram.com/reel/DYO-SGJT6kW/";

function isInstagramUrl(url) {
  return /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\//i.test(url);
}

function cleanResult(data, code = 200) {
  const first = Array.isArray(data?.url) ? data.url[0] : null;

  if (!first?.url) {
    return {
      status: false,
      code,
      error: "Media tidak ditemukan",
    };
  }

  return {
    status: true,
    code,
    title: data?.meta?.title || null,
    username: data?.meta?.username || null,
    shortcode: data?.meta?.shortcode || null,
    quality: first.subname || first.quality || null,
    type: first.type || null,
    ext: first.ext || null,
    url: first.url,
    thumbnail: data?.thumb || null,
  };
}

export async function igdl(url) {
  if (!url) {
    return {
      status: false,
      code: 400,
      error: "Link Instagram kosong",
    };
  }

  if (!isInstagramUrl(url)) {
    return {
      status: false,
      code: 400,
      error: "Link harus Instagram reel/post/tv",
    };
  }

  const headers = {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: "https://sssinstagram.com",
    referer: "https://sssinstagram.com/",
    "user-agent":
      "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
  };

  try {
    const response = await fetch(API, {
      method: "POST",
      headers,
      body: JSON.stringify({ url }),
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        status: false,
        code: response.status,
        error: text,
      };
    }

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      return {
        status: false,
        code: 500,
        error: "Response bukan JSON valid",
        raw: text,
      };
    }

    return cleanResult(json, response.status);
  } catch (error) {
    return {
      status: false,
      code: 500,
      error: error.message,
    };
  }
}

// CLI / direct run mode
const isCli = import.meta.url === `file://${process.argv[1]}`;

if (isCli) {
  const url = process.argv[2] || DEMO_URL;
  const save = process.argv.includes("--save");

  igdl(url)
    .then(async (result) => {
      console.log(JSON.stringify(result, null, 2));

      if (save) {
        await fs.writeFile(
          "igdl-result.json",
          JSON.stringify(result, null, 2),
          "utf8"
        );

        console.log("\nsaved => igdl-result.json");
      }
    })
    .catch((error) => {
      console.log(
        JSON.stringify(
          {
            status: false,
            code: 500,
            error: error.message,
          },
          null,
          2
        )
      );

      process.exit(1);
    });
  }
