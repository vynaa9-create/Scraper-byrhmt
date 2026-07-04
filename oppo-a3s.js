import axios from "axios";
import * as cheerio from "cheerio";

const QUERY = "oppo a3s";

async function request(url) {
    const { data } = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    return data;
}

async function search(keyword) {
    const html = await request(`https://carisinyal.com/?s=${encodeURIComponent(keyword)}`);
    const $ = cheerio.load(html);
    const result = [];

    $(".oxy-post").each((_, el) => {
        const title = $(el).find(".oxy-post-title").text().trim();
        if (!title) return;

        result.push({
            title,
            type: $(el).find(".oxy-post-meta").text().trim(),
            url: $(el).find(".oxy-post-title").attr("href")
        });
    });

    return result;
}

async function detail(url) {
    const html = await request(url);
    const $ = cheerio.load(html);
    const specs = {};

    $("table.box-info tr.box-baris").each((_, el) => {
        const key = $(el).find("td.kolom-satu").text().trim();
        const value = $(el).find("td.kolom-dua").text().trim();
        if (key && value) specs[key] = value;
    });

    const get = (...keys) => {
        for (const key of keys) if (specs[key]) return specs[key];
        return null;
    };

    return {
        status: true,
        title: $("h1").first().text().trim(),
        image: $('meta[property="og:image"]').attr("content") || null,
        description: $('meta[name="description"]').attr("content") || "",
        release: get("Rilis"),
        network: get("Jaringan"),
        display: {
            type: get("Jenis"),
            size: get("Ukuran"),
            resolution: get("Resolusi"),
            refreshRate: get("Refresh Rate"),
            ratio: get("Rasio"),
            density: get("Kerapatan"),
            protection: get("Proteksi")
        },
        performance: {
            chipset: get("Chipset"),
            cpu: get("CPU"),
            gpu: get("GPU"),
            ram: get("RAM"),
            ramType: get("Jenis RAM"),
            storage: get("Memori Internal"),
            storageType: get("Jenis Memori"),
            external: get("Memori Eksternal")
        },
        battery: {
            capacity: get("Kapasitas"),
            charging: get("Daya Pengisian"),
            wireless: get("Wireless Charging"),
            reverse: get("Reverse Charging"),
            reverseWireless: get("Reverse Wireless Charging"),
            bypass: get("Bypass Charging")
        },
        camera: {
            total: get("Jumlah Kamera"),
            configuration: get("Konfigurasi"),
            features: get("Fitur"),
            video: get("Resolusi Video")
        },
        connectivity: {
            wlan: get("WLAN"),
            bluetooth: get("Bluetooth"),
            infrared: get("Infrared"),
            nfc: get("NFC"),
            gps: get("GPS"),
            usb: get("USB")
        },
        system: {
            os: get("OS (Saat Rilis)"),
            update: get("Jaminan Update")
        },
        body: {
            dimensions: get("Dimensi"),
            weight: get("Berat"),
            resistance: get("Ketahanan"),
            sim: get("SIM Card"),
            esim: get("eSIM"),
            colors: get("Warna")
        },
        sensors: get("Sensor"),
        audio: {
            jack: get("Jack 3.5mm"),
            features: get("Fitur Lainnya")
        },
        specs
    };
}

(async () => {
    try {
        const results = await search(QUERY);
        const phone = results.find(r => (r.type || "").toLowerCase().includes("ponsel")) || results[0];

        if (!phone) {
            console.log(JSON.stringify({ status: false, message: "Ponsel tidak ditemukan." }, null, 2));
            return;
        }

        const data = await detail(phone.url);
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(JSON.stringify({ status: false, message: e.message }, null, 2));
    }
})();
