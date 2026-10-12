const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const PF = require('../js/algorithms.js');
const root = path.resolve(__dirname, '..');
const entry = pathToFileURL(path.join(root, 'index.html')).href;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pathfind-smoke-'));
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined, headless: true });
  let server;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, locale: 'zh-CN' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(entry);
    await page.waitForFunction(() => document.querySelector('#grid').width > 0 && document.querySelector('#status-text').textContent === '地图已就绪');
    await wait(100);
    await page.screenshot({ path: `${directory}/desktop.png`, fullPage: true });
    assert.equal(await page.locator('#columns').inputValue(), '41');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('.brand-subtitle, .panel-heading, .workspace-heading, .workspace-footer, #algorithm-description').count(), 0);
    assert.deepEqual(await page.locator('.control-section').first().evaluate(el => {
      const style = getComputedStyle(el);
      return [style.marginTop, style.paddingTop, style.borderTopWidth];
    }), ['0px', '0px', '0px']);
    const cell = async (x, y) => page.evaluate(({ x, y }) => {
      const canvas = document.querySelector('#grid');
      const rect = canvas.getBoundingClientRect();
      const w = Number(document.querySelector('#columns').value);
      const h = Number(document.querySelector('#rows').value);
      return { x: rect.left + (x + .5) * rect.width / w, y: rect.top + (y + .5) * rect.height / h };
    }, { x, y });
    const terrain = async () => {
      await wait(40);
      return page.evaluate(() => {
        const c = document.querySelector('#grid');
        const ctx = c.getContext('2d');
        const w = Number(document.querySelector('#columns').value);
        const h = Number(document.querySelector('#rows').value);
        const walls = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const p = ctx.getImageData(Math.floor((x + .28) * c.width / w), Math.floor((y + .28) * c.height / h), 1, 1).data;
          walls.push(p[0] === 82 && p[1] === 97 && p[2] === 110 ? 1 : 0);
        }
        return walls;
      });
    };
    const finish = async () => { await page.waitForFunction(() => !document.querySelector('#run').disabled, { timeout: 15000 }); await wait(40); };
    const setFast = async () => page.locator('#speed').evaluate(el => { el.value = 100; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const checkEnglish = async target => {
      assert.equal(await target.locator('html').getAttribute('lang'), 'en');
      assert.equal(await target.title(), 'PathFind · Pathfinding Visualizer');
      assert.equal(await target.locator('#run span').textContent(), 'Find path');
      assert.equal(await target.locator('#seed').getAttribute('placeholder'), 'Blank for a random seed');
      assert.equal(await target.locator('[data-tool="wall"]').getAttribute('title'), 'Draw walls (W)');
      assert.equal(await target.locator('#step').getAttribute('aria-label'), 'Step forward');
      const untranslated = await target.evaluate(() => {
        const dictionary = window.PathFindI18n.messages.en;
        return [...document.querySelectorAll('[data-i18n]')].filter(el => el.textContent !== dictionary[el.dataset.i18n]).map(el => el.dataset.i18n);
      });
      assert.deepEqual(untranslated, []);
    };

    // Real animation, pause freezes progress; a single step advances exactly one event.
    await page.locator('#run').click();
    await page.waitForFunction(() => Number(document.querySelector('#visited-count').textContent) > 2);
    await page.locator('#language').selectOption('en');
    await checkEnglish(page);
    assert.match(await page.locator('#status-text').textContent(), /A\* is exploring/);
    const runningCount = Number(await page.locator('#visited-count').textContent());
    await page.waitForFunction(count => Number(document.querySelector('#visited-count').textContent) > count, runningCount);
    await page.locator('#language').selectOption('zh-CN');
    await page.locator('#pause').click();
    const paused = Number(await page.locator('#visited-count').textContent());
    await wait(160);
    assert.equal(Number(await page.locator('#visited-count').textContent()), paused);
    const canvasCells = () => page.locator('#grid').evaluate(el => {
      const width = Number(document.querySelector('#columns').value);
      const height = Number(document.querySelector('#rows').value);
      const ctx = el.getContext('2d');
      const pixels = [];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        pixels.push([...ctx.getImageData(Math.floor((x + .2) * el.width / width), Math.floor((y + .2) * el.height / height), 1, 1).data]);
      }
      return pixels;
    });
    const pausedCanvas = await canvasCells();
    const pausedTime = await page.locator('#compute-time').textContent();
    await page.locator('#language').selectOption('en');
    await checkEnglish(page);
    await wait(40);
    assert.deepEqual(await canvasCells(), pausedCanvas);
    assert.equal(await page.locator('#compute-time').textContent(), pausedTime);
    assert.equal(Number(await page.locator('#visited-count').textContent()), paused);
    assert.match(await page.locator('#status-text').textContent(), /^Paused/);
    assert.equal(await page.locator('#pause span').textContent(), 'Resume');
    assert.equal(await page.locator('#language').isDisabled(), false);
    await page.locator('#step').click();
    assert.equal(Number(await page.locator('#visited-count').textContent()), paused + 1);
    await page.locator('#language').selectOption('zh-CN');
    assert.equal(await page.locator('#columns').isDisabled(), true);
    await setFast();
    await page.locator('#pause').click();
    await finish();
    const shortest = Number(await page.locator('#path-length').textContent());
    assert.ok(shortest > 24);
    await page.locator('#language').selectOption('en');
    assert.equal(Number(await page.locator('#path-length').textContent()), shortest);
    assert.equal(await page.locator('#path-note').textContent(), 'Shortest path found');
    assert.match(await page.locator('#status-text').textContent(), /found the shortest path/);
    await page.locator('#language').selectOption('zh-CN');
    for (const name of ['dijkstra', 'bfs', 'dfs']) {
      await page.locator('#algorithm').selectOption(name);
      assert.equal(await page.locator('#visited-count').textContent(), '0');
      await page.locator('#run').click();
      await finish();
      if (name !== 'dfs') assert.equal(Number(await page.locator('#path-length').textContent()), shortest);
      else assert.match(await page.locator('#path-note').textContent(), /不保证最短/);
    }
    console.log('PASS file://, all four searches, pause/resume and single step');

    // Mouse editing, interpolation, right-click erase and moving endpoints.
    await page.locator('#clear-map').click();
    let p = await cell(2, 2); let q = await cell(7, 2);
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y); await page.mouse.up();
    let walls = await terrain();
    for (let x = 2; x <= 7; x++) assert.equal(walls[2 * 41 + x], 1);
    p = await cell(4, 2);
    await page.mouse.move(p.x, p.y); await page.mouse.down({ button: 'right' }); await page.mouse.move(q.x, q.y); await page.mouse.up({ button: 'right' });
    walls = await terrain();
    assert.equal(walls[2 * 41 + 2], 1);
    for (let x = 4; x <= 7; x++) assert.equal(walls[2 * 41 + x], 0);
    await page.locator('[data-tool="start"]').click();
    p = await cell(2, 2); await page.mouse.click(p.x, p.y);
    assert.equal((await terrain())[2 * 41 + 2], 0);
    q = await cell(3, 3);
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y); await page.mouse.up();
    await page.keyboard.press('w'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    assert.equal((await terrain())[3 * 41 + 4], 1);
    await page.locator('#zoom-in').click(); assert.equal(await page.locator('#zoom-value').textContent(), '120%');
    await page.locator('#zoom-fit').click(); assert.equal(await page.locator('#zoom-value').textContent(), '100%');
    await page.locator('#run').click(); await page.locator('#stop').click();
    assert.match(await page.locator('#status-text').textContent(), /已停止/);
    assert.equal(await page.locator('#columns').isDisabled(), false);
    console.log('PASS mouse drawing, fast drag, right erase, endpoints, keyboard, zoom and stop');

    await page.locator('#columns').fill('10'); await page.locator('#rows').fill('8');
    await page.locator('#grid-form button').click();
    assert.equal(await page.locator('#grid-size').textContent(), '10 × 8 网格');
    await page.locator('#seed').fill('browser-smoke');
    await page.locator('#language').selectOption('en');
    for (const name of ['dfs', 'prim', 'kruskal', 'division']) {
      await page.locator('#maze').selectOption(name);
      await page.locator('#generate-maze').click();
      await finish();
      assert.equal(await page.locator('#columns').inputValue(), '11');
      assert.equal(await page.locator('#rows').inputValue(), '9');
      walls = await terrain();
      const expected = PF.generateMaze(11, 9, name, 'browser-smoke');
      assert.deepEqual(walls, [...expected.walls]);
      assert.match(await page.locator('#status-text').textContent(), /maze generated.*Seed: browser-smoke/);
      assert.equal(await page.locator('#grid-size').textContent(), '11 × 9 grid');
      await page.locator('#generate-maze').click(); await finish();
      assert.deepEqual(await terrain(), walls);
      await page.locator('#algorithm').selectOption('astar');
      await page.locator('#run').click(); await finish();
      assert.equal(Number(await page.locator('#path-length').textContent()), PF.findPath(expected).cost);
    }
    await page.locator('#language').selectOption('zh-CN');
    console.log('PASS all four maze generators in English, normalization, seeds and generated-maze pathfinding');

    // Unreachable map should finish cleanly, never claim a path.
    await page.locator('#columns').fill('5'); await page.locator('#rows').fill('5'); await page.locator('#grid-form button').click();
    await page.locator('[data-tool="wall"]').click();
    p = await cell(2, 0); q = await cell(2, 4);
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y); await page.mouse.up();
    await page.locator('#run').click(); await finish();
    assert.match(await page.locator('#status-text').textContent(), /未找到可达路径/);
    await page.locator('#language').selectOption('en');
    assert.match(await page.locator('#status-text').textContent(), /^No path found/);
    assert.equal(await page.locator('#path-note').textContent(), 'The end is unreachable from the start');
    await page.locator('#language').selectOption('zh-CN');
    await page.locator('#demo').click();
    await page.locator('#help-link').click(); assert.equal(await page.locator('#help-dialog').evaluate(el => el.open), true);
    await page.locator('#language').evaluate(el => { el.value = 'en'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.equal(await page.locator('#help-title').textContent(), 'QUICK START');
    assert.equal(await page.locator('#help-dialog').getAttribute('aria-labelledby'), 'help-title');
    assert.match(await page.locator('#help-dialog').textContent(), /Choose a maze algorithm/);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#help-dialog').evaluate(el => el.open), false);
    await page.locator('#language').selectOption('zh-CN');
    console.log('PASS no-path case, demo reset and accessible help dialog');

    // Largest grid, random seed, and cancellation must leave no stale timer.
    await page.locator('#columns').fill('101'); await page.locator('#rows').fill('101');
    await page.locator('#grid-form button').click();
    assert.equal(await page.locator('#grid-size').textContent(), '101 × 101 网格');
    for (let i = 0; i < 10; i++) await page.locator('#zoom-in').click();
    assert.equal(await page.locator('#zoom-value').textContent(), '300%');
    await page.locator('#zoom-fit').click();
    await page.locator('#seed').fill('');
    await page.locator('#maze').selectOption('dfs');
    await page.locator('#generate-maze').click();
    assert.match(await page.locator('#seed').inputValue(), /^\d+$/);
    await page.locator('#pause').click();
    await page.locator('#stop').click();
    const stopped = await terrain();
    await wait(150);
    assert.deepEqual(await terrain(), stopped);
    assert.equal(await page.locator('#generate-maze').isDisabled(), false);
    await page.locator('#demo').click();
    console.log('PASS largest grid, zoom limit, automatic seed and maze cancellation');

    // Mobile layout and real touch input.
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'zh-CN' });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(entry); await wait(150);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.screenshot({ path: `${directory}/mobile.png`, fullPage: true });
    const tap = await mobile.locator('#grid').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width * 2.5 / 41, y: r.top + r.height * 2.5 / 25 }; });
    await mobile.touchscreen.tap(tap.x, tap.y);
    await wait(40);
    const touchWall = await mobile.locator('#grid').evaluate(el => [...el.getContext('2d').getImageData(Math.floor(el.width * 2.28 / 41), Math.floor(el.height * 2.28 / 25), 1, 1).data].slice(0, 3));
    assert.deepEqual(touchWall, [82, 97, 110]);
    await mobile.locator('#language').selectOption('en');
    await checkEnglish(mobile);
    for (const width of [320, 390, 768]) {
      await mobile.setViewportSize({ width, height: 844 });
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `English layout at ${width}px`);
    }
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.screenshot({ path: `${directory}/mobile-en.png`, fullPage: true });
    await mobile.locator('#mobile-run').click();
    await mobile.waitForFunction(() => document.querySelector('#run').disabled);
    await mobile.locator('#mobile-run').click();
    assert.equal(await mobile.locator('#mobile-run span').textContent(), 'Resume playback');
    assert.equal(await mobile.locator('#mobile-step').isDisabled(), false);
    await mobile.locator('#mobile-step').click();
    await mobile.locator('#mobile-stop').click();
    assert.equal(await mobile.locator('#run').isDisabled(), false);
    await mobile.reload();
    await mobile.waitForFunction(() => document.querySelector('#status-text').textContent === 'Map ready');
    await checkEnglish(mobile);
    console.log('PASS mobile layouts, touchscreen, translated playback and file:// preference persistence');

    const english = await browser.newPage({ locale: 'en-US' });
    english.on('pageerror', error => errors.push(error.message));
    await english.goto(entry);
    await english.waitForFunction(() => document.querySelector('#status-text').textContent === 'Map ready');
    await checkEnglish(english);
    await english.screenshot({ path: `${directory}/desktop-en.png`, fullPage: true });
    await english.locator('#speed').evaluate(el => { el.value = 100; el.dispatchEvent(new Event('input', { bubbles: true })); });
    for (const algorithm of ['astar', 'dijkstra', 'bfs', 'dfs']) {
      await english.locator('#algorithm').selectOption(algorithm);
      await english.locator('#run').click();
      await english.waitForFunction(() => !document.querySelector('#run').disabled);
      assert.equal(Number(await english.locator('#path-length').textContent()) > 0, true);
      assert.equal(await english.locator('#path-note').textContent(), algorithm === 'dfs' ? 'Path found; may not be shortest' : 'Shortest path found');
    }
    await english.locator('#algorithm').evaluate(el => {
      el.add(new Option('Invalid', 'unknown'));
      el.value = 'unknown';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await english.locator('#run').click();
    assert.equal(await english.locator('#status-text').textContent(), 'Unknown pathfinding algorithm.');
    await english.locator('#language').selectOption('zh-CN');
    assert.equal(await english.locator('#status-text').textContent(), '未知寻路算法。');
    console.log('PASS all four English searches and error-message translation');
    const blocked = await browser.newPage({ locale: 'fr-FR' });
    blocked.on('pageerror', error => errors.push(error.message));
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    await blocked.goto(entry);
    await blocked.waitForFunction(() => document.querySelector('#status-text').textContent === '地图已就绪');
    await blocked.locator('#language').selectOption('en');
    await checkEnglish(blocked);
    await blocked.locator('#run').click();
    await blocked.locator('#stop').click();
    assert.match(await blocked.locator('#status-text').textContent(), /^Search animation stopped/);
    console.log('PASS browser language detection, fallback and switching with storage disabled');

    // Static server and assets, including HEAD/404/405.
    server = spawn(process.execPath, [path.join(root, 'scripts/serve.js')], { env: { ...process.env, PORT: '0' }, stdio: 'pipe' });
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Static server startup timed out')), 10000);
      server.stdout.once('data', data => { clearTimeout(timer); resolve(String(data).match(/http:\/\/127\.0\.0\.1:\d+/)[0]); });
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Static server exited: ${code}`)); });
    });
    const response = await page.goto(`${url}/`); assert.equal(response.status(), 200);
    await page.waitForFunction(() => document.querySelector('#status-text').textContent === '地图已就绪');
    for (const [file, type] of [['/styles.css', 'text/css'], ['/favicon.svg', 'image/svg+xml'], ['/js/app.js', 'text/javascript'], ['/js/algorithms.js', 'text/javascript'], ['/js/i18n.js', 'text/javascript']]) {
      const asset = await fetch(`${url}${file}`);
      assert.equal(asset.status, 200);
      assert.ok(asset.headers.get('content-type').startsWith(type));
    }
    assert.equal((await fetch(`${url}/.git/config`)).status, 404);
    assert.equal((await fetch(`${url}/`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${url}/`, { method: 'HEAD' })).status, 200);
    await page.locator('#language').selectOption('en');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#status-text').textContent === 'Map ready');
    await checkEnglish(page);
    assert.deepEqual(errors, []);
    console.log('PASS HTTP serving, asset types, errors and no browser console exceptions');
    console.log(`ALL BROWSER SMOKE CHECKS PASSED. Screenshots: ${directory}`);
  } finally { if (server) server.kill(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
