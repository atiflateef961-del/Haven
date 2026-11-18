import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const origin = process.env.QA_SITE_URL ?? "http://localhost:3000";
const screenshotDir = resolve("qa-screenshots");
await mkdir(screenshotDir, { recursive: true });
const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const target = targets.find((item) => item.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("No headless Chromium page target is available");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolvePromise, reject) => { ws.addEventListener("open", resolvePromise, { once: true }); ws.addEventListener("error", reject, { once: true }); });

let nextId = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
    }
  } else events.push(message);
});
function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolvePromise, reject) => {
    pending.set(id, { resolve: resolvePromise, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  return result.result?.value;
}
await Promise.all([command("Page.enable"), command("Runtime.enable"), command("Network.enable")]);
await command("Page.addScriptToEvaluateOnNewDocument", { source: `window.__qaLcp = 0; new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__qaLcp = Math.max(window.__qaLcp, entry.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });` });

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
async function navigate(url) {
  events.length = 0;
  await command("Page.navigate", { url });
  await sleep(1400);
  const settled = await evaluate(`({title:document.title,href:location.href,ready:document.readyState})`);
  const response = events.find((event) => event.method === "Network.responseReceived" && event.params.type === "Document");
  const redirects = events.filter((event) => event.method === "Network.requestWillBeSent" && event.params.redirectResponse).map((event) => ({status:event.params.redirectResponse.status,url:event.params.redirectResponse.url,to:event.params.request.url}));
  const consoleErrors = events.filter((event) => event.method === "Runtime.exceptionThrown" ||
    (event.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(event.params.type)))
    .map((event) => event.method === "Runtime.exceptionThrown" ? event.params.exceptionDetails.text : event.params.args?.map((arg) => arg.value ?? arg.description).join(" "));
  const failedRequests = events.filter((event) => event.method === "Network.loadingFailed").map((event) => ({ url: events.find((entry) => entry.method === "Network.requestWillBeSent" && entry.params.requestId === event.params.requestId)?.params.request.url, error: event.params.errorText }));
  const httpErrors = events.filter((event) => event.method === "Network.responseReceived" && event.params.response.status >= 400).map((event) => ({ status: event.params.response.status, url: event.params.response.url, type: event.params.type }));
  const page = await evaluate(`(() => {
    const text = document.body?.innerText ?? '';
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({text:a.innerText.trim(),href:a.href}));
    const inputs = [...document.querySelectorAll('input,textarea,select')].map((e) => ({tag:e.tagName.toLowerCase(),type:e.type||'',name:e.name||'',required:e.required,label:!!(e.labels?.length||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby'))}));
    const buttons = [...document.querySelectorAll('button,[role=button]')].map((e) => ({text:(e.innerText||e.getAttribute('aria-label')||'').trim(),disabled:!!e.disabled}));
    const images = [...document.images].map((i) => ({src:i.currentSrc||i.src,loaded:i.complete&&i.naturalWidth>0}));
    const forms = [...document.forms].map((f) => ({action:f.action,valid:f.checkValidity(),fields:f.elements.length}));
    const bodyText = text.replace(/\\s+/g,' ');
    return {text:bodyText.slice(0,2000),dom:document.documentElement.outerHTML,links,inputs,buttons,images,forms,overflow:document.documentElement.scrollWidth>innerWidth,scrollWidth:document.documentElement.scrollWidth,innerWidth,undefinedText:/\\b(undefined|null|NaN)\\b/i.test(bodyText),lcp:window.__qaLcp||0};
  })()`);
  return { ...settled, status: response?.params.response.status ?? null, redirects, consoleErrors, failedRequests, httpErrors, page };
}

const routes = new Map();
const queue = [
  { url: `${origin}/`, depth: 0 },
  ...["/login", "/dashboard", "/hostels", "/students", "/bookings", "/invoices", "/my-profile"].map((path) => ({url:new URL(path,origin).href,depth:1})),
];
while (queue.length) {
  const { url, depth } = queue.shift();
  const normalized = new URL(url);
  normalized.hash = "";
  if (normalized.origin !== new URL(origin).origin || routes.has(normalized.href)) continue;
  const desktop = await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const result = await navigate(normalized.href);
  const routeSlug = new URL(normalized.href).pathname.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
  await mkdir(resolve(screenshotDir, "dom"), { recursive: true });
  await writeFile(resolve(screenshotDir, "dom", `${routeSlug}.html`), result.page.dom, "utf8");
  delete result.page.dom;
  routes.set(normalized.href, result);
  const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(resolve(screenshotDir, `${new URL(normalized.href).pathname.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-desktop.png`), Buffer.from(shot.data, "base64"));
  if (depth < 2) for (const link of result.page.links) {
    try { const next = new URL(link.href); if (next.origin === new URL(origin).origin) queue.push({ url: next.href, depth: depth + 1 }); } catch {}
  }
  await desktop;
}

const responsive = [];
for (const url of routes.keys()) {
  await command("Emulation.setDeviceMetricsOverride", { width: 375, height: 844, deviceScaleFactor: 1, mobile: true });
  const result = await navigate(url);
  const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const filename = `${new URL(url).pathname.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-mobile.png`;
  await writeFile(resolve(screenshotDir, filename), Buffer.from(shot.data, "base64"));
  responsive.push({ url, overflow: result.page.overflow, width: result.page.innerWidth, scrollWidth: result.page.scrollWidth, consoleErrors: result.consoleErrors });
}
await command("Emulation.clearDeviceMetricsOverride");
await navigate(`${origin}/login`);
await sleep(1200);
const interactionChecks = await evaluate(`(async () => {
  const email = document.querySelector('input[name="email"]');
  const form = document.querySelector('form');
  const theme = document.querySelector('.ui-theme-toggle');
  const beforeTheme = theme?.getAttribute('aria-pressed');
  const continueButton = [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Continue');
  const initialEmailStep = !!email && !document.querySelector('input[name="password"]') && !!continueButton;
  const setValue = (element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setValue(email, 'not-an-email');
  continueButton?.click();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const invalidEmailRejected = !!document.querySelector('[role="alert"]') && !document.querySelector('input[name="password"]');
  setValue(email, 'flow-check@example.com');
  [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Continue')?.click();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const password = document.querySelector('input[name="password"]');
  const passwordStepShown = password?.type === 'password' &&
    [...document.querySelectorAll('button')].some((button) => button.innerText.trim() === 'Sign in');
  const showButton = [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Show');
  showButton?.click();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const visiblePassword = password?.type === 'text';
  [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Hide')?.click();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const hiddenPassword = password?.type === 'password';
  [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Change email')?.click();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const changeEmailReturnsToEntry = !document.querySelector('input[name="password"]') &&
    document.querySelector('input[name="email"]')?.value === 'flow-check@example.com';
  theme?.click();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const themeChanged = beforeTheme !== theme?.getAttribute('aria-pressed');
  return {initialEmailStep, invalidEmailRejected, passwordStepShown, changeEmailReturnsToEntry, visiblePassword, hiddenPassword, themeChanged, loginFieldsLabeled:[...document.querySelectorAll('input')].every((input)=>!!(input.labels?.length||input.getAttribute('aria-label')||input.getAttribute('aria-labelledby'))),buttonsLabeled:[...document.querySelectorAll('button')].every((button)=>!!(button.innerText.trim()||button.getAttribute('aria-label'))),formPresent:!!form};
})()`);
const report = { origin, createdAt: new Date().toISOString(), routes: Object.fromEntries(routes), mobile: responsive, interactions: interactionChecks, screenshots: screenshotDir };
await writeFile(resolve("qa-screenshots", "inventory.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({origin,routeCount:routes.size,routes:[...routes].map(([url,r])=>({url,title:r.title,finalUrl:r.href,status:r.status,redirects:r.redirects,consoleErrors:r.consoleErrors,httpErrors:r.httpErrors,failedRequests:r.failedRequests,overflow:r.page.overflow,inputs:r.page.inputs.length,buttons:r.page.buttons.length,links:r.page.links.length,images:r.page.images.filter(i=>!i.loaded),lcp:r.page.lcp})),mobile:responsive,interactions:interactionChecks},null,2));
ws.close();
