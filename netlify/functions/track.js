// Netlify Serverless Function: Visitor & Click Tracking to Telegram
// Keeps bot token and client IP completely secure server-side

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "9168530398:AAGtjkLv058FfSMMwc4kUO2-5LYy9JnduPc";
const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "6531482339";

function parseDevice(ua, clientModel) {
  if (!ua) return "ไม่ทราบอุปกรณ์";

  // Check iOS
  if (/iPhone/i.test(ua)) {
    return clientModel ? `Apple iPhone (${clientModel})` : "Apple iPhone (iOS)";
  }
  if (/iPad/i.test(ua)) return "Apple iPad";
  
  // Check Android Models
  if (/Android/i.test(ua)) {
    if (clientModel) return `Android: ${clientModel}`;
    // Extract Android model regex e.g. Android 13; SM-G991B or Build/TP1A
    const match = ua.match(/Android[^;]+;\s*([^;)]+)\s*[;)]/i);
    if (match && match[1]) {
      const model = match[1].replace(/Build\/.*/i, "").trim();
      return `Android (${model})`;
    }
    return "Android Smartphone";
  }

  // Check Desktop
  if (/Windows/i.test(ua)) return "Windows PC / Laptop";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac / MacBook";
  if (/Linux/i.test(ua)) return "Linux Desktop";

  return clientModel || "อุปกรณ์อื่นๆ";
}

function parseBrowser(ua) {
  if (!ua) return "";
  if (/Line\//i.test(ua)) return " [เปิดผ่านแอป LINE]";
  if (/FBAN|FBAV/i.test(ua)) return " [เปิดผ่านแอป Facebook]";
  if (/Instagram/i.test(ua)) return " [เปิดผ่าน Instagram]";
  if (/Twitter|X\//i.test(ua)) return " [เปิดผ่าน Twitter / X]";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return " (Chrome)";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return " (Safari)";
  if (/Edg/i.test(ua)) return " (Edge)";
  return "";
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const userAgent = event.headers["user-agent"] || data.userAgent || "";
    
    // Real IP resolution
    const clientIp = event.headers["x-nf-client-connection-ip"] || 
                     event.headers["client-ip"] || 
                     (event.headers["x-forwarded-for"] || "").split(",")[0].trim() || 
                     data.clientIp || 
                     "Unknown IP";

    // Location resolution from Netlify Geo context or fallback
    let country = "ไทย";
    let city = "";
    let region = "";

    if (context && context.geo) {
      country = context.geo.country ? (context.geo.country.name || context.geo.country.code || "ไทย") : "ไทย";
      city = context.geo.city || "";
      region = context.geo.subdivision ? (context.geo.subdivision.name || "") : "";
    }

    // Format location string
    let locationStr = "ไม่ระบุตำแหน่ง";
    if (city || region) {
      locationStr = [city, region, country].filter(Boolean).join(", ");
    } else if (data.location) {
      locationStr = data.location;
    } else {
      locationStr = country || "ประเทศไทย 🇹🇭";
    }

    const device = parseDevice(userAgent, data.deviceModel) + parseBrowser(userAgent);
    
    // Format Referrer / Traffic source
    let source = "กดเข้าชมโดยตรง (Direct)";
    if (data.referrer) {
      const ref = data.referrer.toLowerCase();
      if (ref.includes("facebook.com")) source = "Facebook (โพสต์ / แชทเฟซบุ๊ก)";
      else if (ref.includes("t.co") || ref.includes("twitter.com") || ref.includes("x.com")) source = "Twitter / X (@alfie_shop)";
      else if (ref.includes("line.me")) source = "แอป LINE Official";
      else if (ref.includes("google.com")) source = "Google Search";
      else source = data.referrer;
    }
    if (data.utmSource) {
      source += ` [แคมเปญ: ${data.utmSource}]`;
    }

    const action = data.action === "CLICK_LINE" 
      ? "🔥 <b>กดปุ่มสั่งซื้อ LINE Official!</b>" 
      : data.action === "CLICK_TWITTER"
      ? "🐦 <b>กดเข้าชม Twitter / X เพจร้าน</b>"
      : "👀 <b>เปิดเข้าสู่หน้าเว็บไซต์หน้าร้าน</b>";

    const now = new Date();
    // Thai time string (UTC+7)
    const timeStr = now.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });

    const message = 
      `🔔 <b>[มีสัญญาณลูกค้าเข้าหน้าร้าน ALFIE SHOP]</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 <b>พฤติกรรม:</b> ${action}\n` +
      `📱 <b>อุปกรณ์:</b> ${device}\n` +
      `🌐 <b>IP Address:</b> <code>${clientIp}</code>\n` +
      `📍 <b>ตำแหน่งที่ตั้ง:</b> ${locationStr}\n` +
      `🔗 <b>แหล่งที่มา:</b> ${source}\n` +
      `⏱️ <b>เวลา:</b> ${timeStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const res = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
