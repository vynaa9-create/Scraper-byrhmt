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

function pickTextFromJson(json) {
  if (!json || typeof json !== "object") return "";

  if (typeof json.delta === "string") return json.delta;
  if (typeof json.textDelta === "string") return json.textDelta;
  if (typeof json.text === "string") return json.text;
  if (typeof json.content === "string") return json.content;
  if (typeof json.answer === "string") return json.answer;
  if (typeof json.response === "string") return json.response;

  if (typeof json.message?.content === "string") return json.message.content;

  if (typeof json.choices?.[0]?.delta?.content === "string") {
    return json.choices[0].delta.content;
  }

  if (typeof json.choices?.[0]?.message?.content === "string") {
    return json.choices[0].message.content;
  }

  if (Array.isArray(json)) {
    return json.map(pickTextFromJson).join("");
  }

  return "";
}

function parseStreamText(text) {
  let answer = "";
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line === "[DONE]") continue;

    if (line.startsWith("data:")) {
      line = line.slice(5).trim();
      if (!line || line === "[DONE]") continue;
    }

    if (/^[a-z0-9]+:/i.test(line)) {
      const prefix = line.slice(0, line.indexOf(":"));
      const value = line.slice(line.indexOf(":") + 1).trim();

      if (prefix === "0") {
        try {
          const parsed = JSON.parse(value);
          answer += typeof parsed === "string" ? parsed : pickTextFromJson(parsed);
        } catch {
          answer += value.replace(/^"|"$/g, "");
        }
        continue;
      }

      try {
        answer += pickTextFromJson(JSON.parse(value));
      } catch {}

      continue;
    }

    try {
      answer += pickTextFromJson(JSON.parse(line));
    } catch {}
  }

  return answer.trim();
}

async function askUnlimitedAI(prompt = USER_PROMPT) {
  const chatId = crypto.randomUUID();
  const deviceId = crypto.randomUUID();
  const anonId = crypto.randomUUID();

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
      ...(answer ? {} : { raw_preview: text.slice(0, 3000) }),
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

const isCli = import.meta.url === `file://${process.argv[1]}`;

if (isCli) {
  const save = process.argv.includes("--save");
  const prompt = process.argv
    .slice(2)
    .filter((arg) => arg !== "--save")
    .join(" ")
    .trim() || USER_PROMPT;

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
