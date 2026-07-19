// 端到端流程验证（Mock provider）：生成测试图 → 上传 → 预检 → 创建任务 → 轮询 → 校验结果图。
// 用法：node scripts/test-flow.mjs
import sharp from "sharp";
import { Readable } from "node:stream";

const BASE = "http://localhost:3000";
let cookie = "";

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers["cookie"] = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  // 捕获 Set-Cookie
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(",")[0].split(";")[0];
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

async function makeImage(label, hue) {
  // 生成带色调的随机噪声图，确保有足够细节通过清晰度检测（Laplacian 方差）
  const W = 600, H = 800;
  const raw = Buffer.alloc(W * H * 3);
  const hueNorm = hue / 360;
  for (let i = 0; i < W * H; i++) {
    const n = Math.random();
    // 简易 HSL→RGB，固定饱和度/亮度 + 噪声扰动
    const v = 60 + n * 120;
    raw[i * 3] = Math.min(255, Math.round(v + (hue < 60 || hue > 300 ? 40 : 0)));
    raw[i * 3 + 1] = Math.min(255, Math.round(v + (hue > 60 && hue < 180 ? 40 : 0)));
    raw[i * 3 + 2] = Math.min(255, Math.round(v + (hue > 180 && hue < 300 ? 40 : 0)));
  }
  const basePng = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  // 直接返回带色调的噪声 PNG（不叠加 SVG 文字层）。
  // 前序诊断：sharp 光栅化 SVG overlay 时会填充不透明背景，覆盖噪声导致 Laplacian 方差=0，
  // 被预检正确拒绝。纯噪声图方差≈533，远超阈值 80。
  // label 参数保留用于日志识别人物图/服装图，不再绘入图像。
  return basePng;
}

function log(n, msg) { console.log(`[${n}] ${msg}`); }

async function upload(role, label, hue) {
  log("1", `initiate ${role}...`);
  const init = await api("/api/uploads/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, contentType: "image/png", sizeBytes: 50000 }),
  });
  console.log("    status:", init.status, "uploadId:", init.json?.uploadId);
  if (init.status !== 200) throw new Error("initiate failed");

  log("2", `upload ${role} file...`);
  const buf = await makeImage(label, hue);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "image/png" }), `${role}.png`);
  form.append("uploadId", init.json.uploadId);
  const up = await api("/api/uploads/upload", { method: "POST", body: form });
  console.log("    status:", up.status, "size:", up.json?.sizeBytes, "w/h:", up.json?.width, up.json?.height);

  log("3", `check ${role}...`);
  const chk = await api("/api/uploads/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId: init.json.uploadId }),
  });
  console.log("    status:", chk.status, "passed:", chk.json?.passed, "summary:", chk.json?.summary);
  if (!chk.json?.passed) throw new Error(`precheck failed: ${chk.json?.summary}`);
  return { uploadId: init.json.uploadId, previewUrl: chk.json.previewUrl };
}

async function main() {
  log("0", "GET / (homepage)");
  const home = await api("/");
  console.log("    homepage status:", home.status, "len:", home.text.length);

  const person = await upload("person", "Person", 210);
  const garment = await upload("garment", "Garment", 30);

  log("4", "create tryon task...");
  const create = await api("/api/tryon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personUploadId: person.uploadId,
      garmentUploadId: garment.uploadId,
      garmentType: "upper",
    }),
  });
  console.log("    status:", create.status, "taskId:", create.json?.taskId);
  if (create.status !== 201) throw new Error("create task failed: " + create.text);
  const taskId = create.json.taskId;

  log("5", "poll task until terminal...");
  let view = null;
  for (let i = 0; i < 20; i++) {
    const r = await api(`/api/tryon/${taskId}`);
    view = r.json;
    console.log(`    poll ${i}: status=${view?.status} results=${view?.results?.length ?? 0}`);
    if (["succeeded", "failed", "timeout", "cancelled"].includes(view?.status)) break;
    await new Promise((x) => setTimeout(x, 2000));
  }

  if (view?.status !== "succeeded") {
    throw new Error(`task did not succeed: ${view?.status} ${view?.lastErrorMessage}`);
  }
  console.log("    results:", view.results.length, "completedAt:", view.completedAt);

  log("6", "fetch a result image via signed URL...");
  for (const r of view.results) {
    const img = await fetch(BASE + r.url);
    const buf = Buffer.from(await img.arrayBuffer());
    console.log(`    result ${r.index}: status=${img.status} bytes=${buf.length} ct=${img.headers.get("content-type")}`);
  }

  log("7", "submit feedback...");
  const fb = await api("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, helpfulLevel: "very_helpful", reasons: ["other"] }),
  });
  console.log("    status:", fb.status, fb.json || fb.text);

  log("8", "submit feedback again (expect 409 conflict)...");
  const fb2 = await api("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, helpfulLevel: "not_helpful" }),
  });
  console.log("    status:", fb2.status, fb2.json?.error?.message || fb2.text);

  log("9", "quota after one successful task...");
  const q = await api("/api/quota");
  console.log("    ", q.json);

  log("10", "delete a result...");
  const del = await api(`/api/tryon/${taskId}/results/${view.results[0].id}`, { method: "DELETE" });
  console.log("    status:", del.status);

  console.log("\n✅ 全流程验证通过");
}

main().catch((e) => {
  console.error("\n❌ 流程失败:", e.message);
  process.exit(1);
});
