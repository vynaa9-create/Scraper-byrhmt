/**
 * Facebook Downloader Scraper
 * ---------------------------
 * Creator  : rhmt
 * Runtime  : NodeJS (MJS)
 * Base     : https://fdown.net/
 *
 * note :
 * scrape santai dulu cuy, yang penting jalan wkwkwk
 */

import fs from "node:fs/promises";
import process from "node:process";
import cloudscraper from "cloudscraper";

const ENDPOINT = "https://fdown.net/download.php";

const DEFAULT_URL =
  "https://www.facebook.com/share/r/14feEB6RzE6/";

const HEADERS = {
  "content-type": "application/x-www-form-urlencoded",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  origin: "https://fdown.net",
  referer: "https://fdown.net/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
};

function decodeHtml(text = "") {
  return String(text)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", `"`)
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .trim();
}

function cleanText(text = "") {
  return decodeHtml(
    String(text)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function getTagById(html, tag, id) {
  const regex = new RegExp(
    `<${tag}[^>]*id=["']${id}["'][^>]*>`,
    "i"
  );

  return html.match(regex)?.[0] || "";
}

function getAttr(tag = "", attr = "") {
  const regex = new RegExp(`${attr}=["']([^"']+)["']`, "i");
  return decodeHtml(tag.match(regex)?.[1] || "");
}

function getDownloadUrl(html, id) {
  const tag = getTagById(html, "a", id);
  return getAttr(tag, "href");
}

function getThumbnail(html) {
  const imgTag =
    html.match(/<img[^>]*class=["'][^"']*lib-img-show[^"']*["'][^>]*>/i)?.[0] ||
    "";

  return getAttr(imgTag, "src");
}

function getTitle(html) {
  const match = html.match(
    /<div[^>]*class=["'][^"']*lib-row\s+lib-header[^"']*["'][^>]*>([\s\S]*?)<div[^>]*class=["'][^"']*lib-header-seperator/i
  );

  return cleanText(match?.[1] || "No video title");
}

function getDescription(html) {
  const match = html.match(
    /<strong>\s*Description:\s*<\/strong>\s*([\s\S]*?)<\/div>/i
  );

  return cleanText(match?.[1] || "");
}

function getDuration(html) {
  const match = html.match(
    /<strong>\s*Duration:\s*<\/strong>\s*([^<]+)/i
  );

  return cleanText(match?.[1] || "");
}

function parseResult(html, input, code = 200) {
  const sd = getDownloadUrl(html, "sdlink");
  const hd = getDownloadUrl(html, "hdlink");

  const results = [];

  if (sd) {
    results.push({
      quality: "SD",
      type: "video",
      url: sd,
    });
  }

  if (hd) {
    results.push({
      quality: "HD",
      type: "video",
      url: hd,
    });
  }

  return {
    status: results.length > 0,
    code,
    creator: "rhmt",
    input,
    title: getTitle(html),
    description: getDescription(html),
    duration: getDuration(html),
    thumbnail: getThumbnail(html),
    total: results.length,
    results,
    ...(results.length === 0
      ? {
          error: "Video tidak ditemukan",
          raw_preview: html.slice(0, 1000),
        }
      : {}),
  };
}

async function fbdl(url = DEFAULT_URL) {
  try {
    if (!url || !String(url).trim()) {
      return {
        status: false,
        code: 400,
        creator: "rhmt",
        error: "URL Facebook kosong",
      };
    }

    const input = String(url).trim();

    const body = new URLSearchParams();
    body.append("URLz", input);

    const html = await cloudscraper.post(ENDPOINT, {
      form: { URLz: input },
      headers: HEADERS
    });

    return parseResult(html, input, 200);
  } catch (err) {
    return {
      status: false,
      code: 500,
      creator: "rhmt",
      error: err.message || "Terjadi kesalahan",
    };
  }
}

export { fbdl };
export default fbdl;

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const save = process.argv.includes("--save");

  const url =
    process.argv
      .slice(2)
      .filter((arg) => arg !== "--save")
      .join(" ")
      .trim() || DEFAULT_URL;

  const result = await fbdl(url);

  console.log(JSON.stringify(result, null, 2));

  if (save) {
    await fs.writeFile(
      "fbdl-result.json",
      JSON.stringify(result, null, 2),
      "utf8"
    );

    console.log("\nsaved => fbdl-result.json");
  }
  }
