import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { waitFor } from './wait.mjs';

const browser = await chromium.launch({ headless: true, executablePath: process.env.WHOSUS_BROWSER || undefined, args: ['--enable-unsafe-swiftshader'] });
await mkdir('artifacts', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [], arrivals = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    try { const message = JSON.parse(String(payload)); if (message.type === 'snapshot') arrivals.push(message.room.players.map(p => ({ id: p.id, seat: p.seat }))); } catch {}
  }));
  await page.goto(process.env.WHOSUS_TEST_URL || 'http://localhost:5173');
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await page.locator('dialog').getByLabel('Explorer name').fill('Seated explorer');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await page.getByText('The usual suspects.').waitFor();
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/store.ts').name;
    window.gameStore = (await import(url)).useGame;
  });
  await waitFor(page, () => {
    const s = window.gameStore.getState();
    return s.room.players.find(p => p.id === s.id).seat === -1;
  });
  assert(arrivals.some(players => players.some(p => p.seat === 0)), 'New arrival must start sitting');
  await page.getByRole('button', { name: 'Sit down', exact: true }).click();
  await waitFor(page, () => { const s = window.gameStore.getState(); return s.room.players.find(p => p.id === s.id).seat === 0; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/seating-desktop.png' });
  await page.waitForTimeout(2100);
  assert.equal(await page.getByRole('button', { name: 'Stand up', exact: true }).count(), 1, 'Manual seating persists');
  await page.getByRole('button', { name: 'Stand up', exact: true }).click();
  await page.getByRole('button', { name: 'Sit down', exact: true }).waitFor();
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Stand up', exact: true }).waitFor();
  await page.keyboard.down('KeyS');
  try { await page.getByRole('button', { name: 'Stand up', exact: true }).waitFor({ state: 'hidden' }); }
  finally { await page.keyboard.up('KeyS'); }
  console.log('PASS: arrival sits then stands, click/E sit and stand, movement stands up');
  await page.evaluate(() => {
    const s = window.gameStore.getState();
    window.seatPeer = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    window.seatPeer.onopen = () => window.seatPeer.send(JSON.stringify({ type: 'join', name: 'Seat witness', code: s.room.code }));
    window.seatPeer.onmessage = e => { const message = JSON.parse(e.data); if (message.type === 'joined') window.seatPeerId = message.id; };
  });
  await waitFor(page, () => window.gameStore.getState().room.players.some(p => p.name === 'Seat witness' && p.seat === 1));
  await waitFor(page, () => window.gameStore.getState().room.players.some(p => p.name === 'Seat witness' && p.seat === -1));
  await page.evaluate(() => window.seatPeer.send(JSON.stringify({ type: 'action', action: 'sit', value: 1 })));
  await waitFor(page, () => window.gameStore.getState().room.players.some(p => p.name === 'Seat witness' && p.seat === 1));
  await page.reload();
  await page.getByText('The usual suspects.').waitFor();
  await page.getByRole('button', { name: 'Sit down', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/seating-mobile-before.png' });
  await page.getByRole('button', { name: 'Sit down', exact: true }).click();
  await page.getByRole('button', { name: 'Stand up', exact: true }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/seating-mobile.png' });
  await page.getByRole('button', { name: 'Stand up', exact: true }).click();
  assert.deepEqual(errors, []);
  console.log('PASS: peer seating is synchronized, reconnection works, phone controls work, no browser errors');
} finally { await browser.close(); }
