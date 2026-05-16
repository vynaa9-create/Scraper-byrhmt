import fs from "node:fs/promises";

const API = "https://api-wh.sssinstagram.com/api/convert";

function isInstagramUrl(url) {
  return /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\//i.test(url);
}

function cleanResult(data) {
  const downloads = Array.isArray(data?.url)
    ? data.url
        .map((item) => ({
          quality: item.subname || item.quality || null,
          type: item.type || null,
          ext: item.ext || null,
          url: item.url || null,
        }))
        .filter((item) => item.url)
    : [];

  return {
    status: downloads.length > 0,
    title: data?.meta?.title || null,
    source: data?.meta?.source || null,
    username: data?.meta?.username || null,
    shortcode: data?.meta?.shortcode || null,
    likes: data?.meta?.like_count || 0,
    comments: data?.meta?.comment_count || 0,
    thumbnail: data?.thumb || null,
    downloads,
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
      body: JSON.stringify({
        url,
      }),
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

    const result = cleanResult(json);

    return {
      ...result,
      code: response.status,
    };
  } catch (error) {
    return {
      status: false,
      code: 500,
      error: error.message,
    };
  }
}

// CLI mode
const isCli = import.meta.url === `file://${process.argv[1]}`;

if (isCli) {
  const url = process.argv[2];
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