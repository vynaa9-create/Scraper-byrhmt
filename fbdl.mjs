/**
 * Facebook Downloader Scraper
 * ---------------------------
 * Creator  : rhmt
 * Runtime  : NodeJS (MJS)
 * Base     : https://fbdownloader.to/
 *
 * note :
 * nyoba fbdl dulu cuy, kalau error jangan ngamuk wkwkwk
 */

import fs from "node:fs/promises";
import process from "node:process";

const BASE = "https://fbdownloader.to";
const HOME = `${BASE}/en`;
const ENDPOINT = `${BASE}/api/ajaxSearch`;

const DEFAULT_URL = "https://www.facebook.com/share/r/18iwqoVSK9/";

const FALLBACK_K_EXP = "1778901003";
const FALLBACK_K_TOKEN =
  "9bdc54b957a2814fed1f70ef8ae4cb1fb54e3ed7803b44ade4044af6cc260ffe";

const HEADERS = {
  "sec-ch-ua-platform": `"Android"`,
  "x-requested-with": "XMLHttpRequest",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  accept: "*/*",
  "sec-ch-ua": `"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"`,
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  "sec-ch-ua-mobile": "?1",
  origin: BASE,
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  referer: HOME,
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
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

function getAttr(tag = "", attr = "") {
  const reg = new RegExp(`${attr}=["']([^"']+)["']`, "i");
  return decodeHtml(tag.match(reg)?.[1] || "");
}

function pickTokenFromHtml(html = "") {
  const kExp =
    html.match(/k_exp\s*=\s*["']([^"']+)["']/i)?.[1] ||
    html.match(/name=["']k_exp["'][^>]*value=["']([^"']+)["']/i)?.[1] ||
    null;

  const kToken =
    html.match(/k_token\s*=\s*["']([^"']+)["']/i)?.[1] ||
    html.match(/name=["']k_token["'][^>]*value=["']([^"']+)["']/i)?.[1] ||
    null;

  if (kExp && kToken) {
    return {
      k_exp: kExp,
      k_token: kToken,
      source: "home",
    };
  }

  return {
    k_exp: FALLBACK_K_EXP,
    k_token: FALLBACK_K_TOKEN,
    source: "fallback",
  };
}

async function getToken() {
  try {
    const res = await fetch(HOME, {
      method: "GET",
      headers: {
        "user-agent": HEADERS["user-agent"],
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": HEADERS["accept-language"],
      },
    });

    const html = await res.text();
    return pickTokenFromHtml(html);
  } catch {
    return {
      k_exp: FALLBACK_K_EXP,
      k_token: FALLBACK_K_TOKEN,
      source: "fallback",
    };
  }
}

function parseMedia(html = "") {
  const results = [];
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const quality = cleanText(
      row.match(/<td[^>]*class=["']video-quality["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] ||
        ""
    );

    if (!quality) continue;

    const directTag =
      row.match(/<a[^>]*class=["'][^"']*download-link-fb[^"']*["'][^>]*>/i)?.[0] ||
      "";

    const renderTag =
      row.match(/<button[^>]*data-videourl=["'][^"']+["'][^>]*>/i)?.[0] ||
      row.match(/<a[^>]*data-fquality=["'][^"']+["'][^>]*>/i)?.[0] ||
      "";

    const directUrl = getAttr(directTag, "href");
    const renderUrl = getAttr(renderTag, "data-videourl");
    const type = row.includes("mp3") ? "audio" : "video";

    if (directUrl) {
      results.push({
        quality,
        type,
        render: false,
        url: directUrl,
      });
      continue;
    }

    if (renderUrl) {
      results.push({
        quality,
        type,
        render: true,
        url: renderUrl,
      });
    }
  }

  return results;
}

function parseResponse(json, input, tokenInfo) {
  const html = json?.data || "";

  const thumbTag =
    html.match(/<img[^>]*src=["'][^"']+["'][^>]*>/i)?.[0] || "";

  const title = cleanText(
    html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "Facebook Video"
  );

  const duration = cleanText(
    html.match(/<h3[^>]*>[\s\S]*?<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      ""
  );

  const audioUrl = decodeHtml(
    html.match(/id=["']audioUrl["'][^>]*value=["']([^"']+)["']/i)?.[1] || ""
  );

  const fbId =
    html.match(/id=["']FbId["'][^>]*value=["']([^"']+)["']/i)?.[1] || null;

  const convertUrl =
    html.match(/k_url_convert\s*=\s*["']([^"']+)["']/i)?.[1] || null;

  const cToken =
    html.match(/c_token\s*=\s*["']([^"']+)["']/i)?.[1] || null;

  const convertExp =
    html.match(/k_exp\s*=\s*["']([^"']+)["']/i)?.[1] || null;

  const results = parseMedia(html);

  if (json?.mess && !html) {
    return {
      status: false,
      code: 200,
      creator: "rhmt",
      input,
      error: json.mess,
      raw: json,
    };
  }

  return {
    status: results.length > 0,
    code: 200,
    creator: "rhmt",
    input,
    title,
    duration,
    thumbnail: getAttr(thumbTag, "src"),
    fbId,
    tokenSource: tokenInfo?.source || null,
    total: results.length,
    results,
    extra: {
      audioUrl: audioUrl || null,
      convertUrl,
      cToken,
      convertExp,
    },
    ...(results.length === 0
      ? {
          error: "Media tidak ditemukan",
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

    if (!/^https?:\/\/(www\.)?(facebook\.com|fb\.watch)\//i.test(input)) {
      return {
        status: false,
        code: 400,
        creator: "rhmt",
        input,
        error: "URL harus dari facebook.com atau fb.watch",
      };
    }

    const tokenInfo = await getToken();

    const body = new URLSearchParams();
    body.append("k_exp", tokenInfo.k_exp);
    body.append("k_token", tokenInfo.k_token);
    body.append("p", "home");
    body.append("q", input);
    body.append("lang", "en");
    body.append("v", "v2");
    body.append("w", "");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: HEADERS,
      body: body.toString(),
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

    return parseResponse(json, input, tokenInfo);
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

  const input =
    process.argv
      .slice(2)
      .filter((arg) => arg !== "--save")
      .join(" ")
      .trim() || DEFAULT_URL;

  const result = await fbdl(input);

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
