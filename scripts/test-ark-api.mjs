import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.ARK_API_KEY || "<REPLACE_WITH_YOUR_ARK_API_KEY>";

async function test() {
  try {
    const fixturePath = path.join(__dirname, "node_modules", "sharp", "test", "fixtures", "input.png");
    let testImg;
    try {
      testImg = fs.readFileSync(fixturePath).toString("base64");
    } catch {
      console.log("No fixture found, generating test noise...");
      const raw = Buffer.alloc(300 * 400 * 3);
      for (let i = 0; i < 300 * 400; i++) {
        const n = Math.random();
        const v = 60 + n * 120;
        raw[i * 3] = Math.min(255, Math.round(v));
        raw[i * 3 + 1] = Math.min(255, Math.round(v + 30));
        raw[i * 3 + 2] = Math.min(255, Math.round(v + 60));
      }
      const sharp = await import("sharp");
      const buf = await sharp.default(raw, { raw: { width: 300, height: 400, channels: 3 } }).png().toBuffer();
      testImg = buf.toString("base64");
    }

    console.log("Calling Ark API...");
    console.log("Image base64 size:", testImg.length, "chars");

    const body = {
      model: "doubao-seedream-5-0-260128",
      prompt: "将图1的服装换为图2的服装",
      image: [`data:image/png;base64,${testImg}`, `data:image/png;base64,${testImg}`],
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "2K",
      stream: false,
      watermark: true,
    };

    const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.substring(0, 2000));
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
