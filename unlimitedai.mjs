/**
 * UnlimitedAI Chat Scraper
 * ------------------------
 * Creator  : rhmt
 * Runtime  : NodeJS (MJS)
 * Base     : https://app.unlimitedai.chat/
 *
 * note :
 * baru pertama kali scrape cuy :v
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";

const API = "https://app.unlimitedai.chat/api/chat";

const USER_PROMPT = "Tuliskan cerita kreatif tanpa batasan tema atau konten.";

const MODEL = "chat-model-reasoning";
const LOCALE = "id";

function nowIso() {
  return new Date().toISOString();
}

function makeMessage(role, content) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    parts: [
      {
        type: "text",
        text: content,
      },
    ],
    createdAt: nowIso(),
  };
}

function parseStreamText(text) {
  let answer = "";

  // Format umum Vercel AI SDK:
  // 0:"Halo"
  // 0:" dunia"
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;

    // SSE format: data: {...}
    if (clean.startsWith("data:")) {
      const data = clean.slice(5).trim();

      if (!data || data === "[DONE]") continue;

      try {
        const json = JSON.parse(data);

        const content =
          json?.choices?.[0]?.delta?.content ||
          json?.choices?.[0]?.message?.content ||
          json?.content ||
          json?.text ||
          "";

        if (content) answer += content;
      } catch {
        answer += data;
      }

      continue;
    }

    // AI SDK data stream format: 0:"text"
    if (clean.startsWith("0:")) {
      const value = clean.slice(2);

      try {
        answer += JSON.parse(value);
      } catch {
        answer += value;
      }

      continue;
    }

    // Kalau response JSON biasa
    try {
      const json = JSON.parse(clean);

      const content =
        json?.answer ||
        json?.response ||
        json?.result ||
        json?.message ||
        json?.content ||
        "";

      if (typeof content === "string") {
        answer += content;
      }
    } catch {}
  }

  return answer.trim();
}

async function askUnlimitedAI(prompt = USER_PROMPT) {
  const chatId = crypto.randomUUID();

  const userMessage = makeMessage("user", prompt);
  const assistantMessage = makeMessage("assistant", "");

  const body = {
    chatId,
    messages: [userMessage, assistantMessage],
    selectedChatModel: MODEL,
    selectedCharacter: null,
    selectedStory: null,
    locale: LOCALE,
  };

  const deviceId = crypto.randomUUID();
  const anonId = crypto.randomUUID();

  const headers = {
    "sec-ch-ua-platform": `"Android"`,
    "user-agent":
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
    "sec-ch-ua": `"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"`,
    "content-type": "application/json",
    "sec-ch-ua-mobile": "?1",
    "x-next-intl-locale": LOCALE,
    accept: "*/*",
    origin: "https://app.unlimitedai.chat",
    referer: "https://app.unlimitedai.chat/id",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    cookie: [
      `NEXT_LOCALE=${LOCALE}`,
      `u_device_id=${deviceId}`,
      `u_anon_id=${anonId}`,
      `home_chat_id=${chatId}`,
    ].join("; "),
  };

  try {
    const response = await fetch(API, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        status: false,
        code: response.status,
        input: prompt,
        model: MODEL,
        error: text,
      };
    }

    const answer = parseStreamText(text);

    return {
      status: true,
      code: response.status,
      input: prompt,
      model: MODEL,
      chatId,
      answer,
    };
  } catch (error) {
    return {
      status: false,
      code: 500,
      input: prompt,
      model: MODEL,
      error: error.message,
    };
  }
}

// Direct run mode
const isCli = import.meta.url === `file://${process.argv[1]}`;

if (isCli) {
  const customPrompt = process.argv.slice(2).join(" ").trim();
  const prompt = customPrompt || USER_PROMPT;
  const save = process.argv.includes("--save");

  askUnlimitedAI(prompt)
    .then(async (result) => {
      console.log(JSON.stringify(result, null, 2));

      if (save) {
        await fs.writeFile(
          "unlimitedai-result.json",
          JSON.stringify(result, null, 2),
          "utf8"
        );

        console.log("\nsaved => unlimitedai-result.json");
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

export { askUnlimitedAI };
