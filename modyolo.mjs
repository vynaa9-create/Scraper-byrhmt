/**
 * 【 modyolo scrape】
 * Creator : rhmt
 * Base    : direct file URL
 * Desc    : Cek metadata file APK tanpa download full
 * Note :
 * sisanya atur sendiri 
 */

import process from "node:process";

const DEFAULT_URL =
  "https://files.modyolo.com/Camera%20Translator/Camera_Translator_%20v2.6.5%20_MOD.apk";

function formatBytes(bytes = 0) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;

  const units = ["B", "KB", "MB", "GB"];
  let size = n;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

function getFileName(url = "") {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").pop() || "");
  } catch {
    return "";
  }
}

async function inspectFile(url = DEFAULT_URL) {
  try {
    if (!url || !/^https?:\/\//i.test(url)) {
      return {
        status: false,
        code: 400,
        creator: "rhmt",
        error: "URL kosong / tidak valid",
      };
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        range: "bytes=0-0",
        "accept-encoding": "identity",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
      },
    });

    const contentRange = res.headers.get("content-range");
    const contentLength = res.headers.get("content-length");
    const contentType = res.headers.get("content-type");
    const lastModified = res.headers.get("last-modified");
    const etag = res.headers.get("etag");

    let totalSize = null;

    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match) totalSize = Number(match[1]);
    }

    if (!totalSize && contentLength) {
      totalSize = Number(contentLength);
    }

    return {
      status: true,
      code: res.status,
      creator: "rhmt",
      input: url,
      filename: getFileName(url),
      type: contentType,
      size: totalSize,
      size_readable: formatBytes(totalSize),
      last_modified: lastModified,
      etag,
      range_supported: Boolean(contentRange),
      content_range: contentRange,
    };
  } catch (err) {
    return {
      status: false,
      code: 500,
      creator: "rhmt",
      error: err.message || "Terjadi kesalahan",
    };
  }
}

export { inspectFile };
export default inspectFile;

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv.slice(2).join(" ").trim() || DEFAULT_URL;
  const result = await inspectFile(url);
  console.log(JSON.stringify(result, null, 2));
}
