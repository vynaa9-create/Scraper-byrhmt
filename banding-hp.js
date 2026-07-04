import axios from "axios";
import * as cheerio from "cheerio";

const QUERY_1 = process.argv[2] || "oppo reno16 f 5g";
const QUERY_2 = process.argv[3] || "oppo reno16 pro 5g";

async function request(url) {
    const { data } = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    return data;
}

function normalize(text = "") {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function score(title, query) {
    const t = normalize(title);
    const q = normalize(query);
    let s = 0;
    if (t === q) s += 100;
    if (t.includes(q)) s += 80;
    if (q.includes(t)) s += 60;
    const words = q.match(/[a-z]+|\d+/g) || [];
    for (const w of words) if (t.includes(w)) s += 10;
    return s;
}

async function getPhoneList() {
    const html = await request("https://carisinyal.com/compare/");
    const $ = cheerio.load(html);
    const list = [];

    $('select[name="hp_1"] option').each((_, el) => {
        const id = $(el).attr("value");
        const title = $(el).text().trim();
        if (id && title) list.push({ id, title });
    });

    return list;
}

function bestMatch(list, query) {
    let best = null;
    let bestScore = -1;
    for (const item of list) {
        const s = score(item.title, query);
        if (s > bestScore) {
            bestScore = s;
            best = item;
        }
    }
    return best;
}

function extractCell($, cell) {
    const img = cell.find("img").first();
    if (img.length) {
        return img.attr("src") || img.attr("data-src") || null;
    }

    const items = cell.find("li");
    if (items.length) {
        return items
            .map((_, li) => $(li).text().replace(/\s+/g, " ").trim())
            .get()
            .join("; ");
    }

    return cell.text().replace(/\s+/g, " ").trim();
}

async function fetchCompare(id1, id2) {
    const html = await request(`https://carisinyal.com/compare/?hp_1=${id1}&hp_2=${id2}`);
    const $ = cheerio.load(html);

    const sections = [];
    let current = { section: "UMUM", rows: [] };

    $(".ct-text-block, .ct-new-columns").each((_, el) => {
        const node = $(el);

        if (node.hasClass("ct-text-block")) {
            // Skip labels that live inside a data row; only standalone headers count.
            if (node.closest(".ct-new-columns").length > 0) return;
            const title = node.text().trim();
            if (!title) return;
            if (current.rows.length) sections.push(current);
            current = { section: title, rows: [] };
            return;
        }

        // .ct-new-columns => one comparison row
        const cells = node.children(".ct-div-block");
        if (cells.length < 3) return;

        const label = cells.eq(0).text().replace(/\s+/g, " ").trim();
        const value1 = extractCell($, cells.eq(1));
        const value2 = extractCell($, cells.eq(2));

        if (!value1 && !value2) return;

        current.rows.push({ label: label || null, value1, value2 });
    });

    if (current.rows.length) sections.push(current);

    return sections;
}

(async () => {
    try {
        const list = await getPhoneList();

        const phone1 = bestMatch(list, QUERY_1);
        const phone2 = bestMatch(list, QUERY_2);

        if (!phone1 || !phone2) {
            console.log(JSON.stringify({ status: false, message: "Salah satu atau kedua HP tidak ditemukan." }, null, 2));
            return;
        }

        const sections = await fetchCompare(phone1.id, phone2.id);

        console.log(JSON.stringify({
            status: true,
            phone1: { id: phone1.id, title: phone1.title },
            phone2: { id: phone2.id, title: phone2.title },
            sections
        }, null, 2));
    } catch (e) {
        console.error(JSON.stringify({ status: false, message: e.message }, null, 2));
    }
})();
