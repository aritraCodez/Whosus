import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  executablePath: process.env.WHOSUS_BROWSER || undefined,
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.route("**/__voice_error__", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Voice failure checks</title>",
    }),
  );
  await page.goto(
    `${process.env.WHOSUS_TEST_URL || "http://127.0.0.1:5173"}/__voice_error__`,
  );
  await page.clock.install();
  await page.evaluate(async () => {
    const { VoiceChat } = await import("/src/voice.ts");
    const { useGame } = await import("/src/store.ts");
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    navigator.mediaDevices.getUserMedia = async () => destination.stream;
    useGame.setState({ room: {}, id: "a", status: "connected" });
    window.RTCPeerConnection = class {
      constructor() {
        throw Error("Simulated unavailable WebRTC");
      }
    };
    const failed = new VoiceChat();
    await failed.enable();
    failed.sync([{ id: "b", gain: 1, sendGain: 1 }]);
    window.constructorFailure = {
      status: useGame.getState().voiceStatus,
      message: useGame.getState().voiceError,
      microphone: (await failed.getDiagnostics()).microphoneEnabled,
    };
    failed.dispose();
    // A fresh live synthetic microphone for retry/deadline checks.
    const retryDestination = audio.createMediaStreamDestination();
    oscillator.connect(retryDestination);
    navigator.mediaDevices.getUserMedia = async () => retryDestination.stream;
    window.createdPeers = 0;
    window.RTCPeerConnection = class {
      connectionState = "new";
      signalingState = "stable";
      constructor() {
        window.createdPeers++;
      }
      addTransceiver() {}
      async createOffer() {
        return { type: "offer", sdp: "m=audio 9 UDP/TLS/RTP/SAVPF 111" };
      }
      async setLocalDescription(description) {
        this.localDescription = description;
      }
      async getStats() {
        return new Map();
      }
      close() {
        this.connectionState = "closed";
      }
    };
    useGame.setState({ room: {}, id: "a", status: "connected" });
    const retry = new VoiceChat();
    window.retryVoice = retry;
    await retry.enable();
    retry.sync([{ id: "b", gain: 1, sendGain: 1 }]);
    window.closeTestAudio = () => {
      retry.dispose();
      oscillator.stop();
      return audio.close();
    };
  });
  const failed = await page.evaluate(() => window.constructorFailure);
  assert.equal(failed.status, "error");
  assert.equal(failed.microphone, false);
  assert.match(failed.message, /unavailable WebRTC/);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const peer = window.retryVoice.peers.get("b");
      peer.pc.connectionState = "failed";
      peer.pc.onconnectionstatechange?.();
    });
    await page.clock.runFor(4000);
  }
  await page.clock.runFor(2000);
  assert.equal(
    await page.evaluate(
      async () =>
        (await import("/src/store.ts")).useGame.getState().voiceStatus,
    ),
    "error",
  );
  const attempts = await page.evaluate(() => window.createdPeers);
  await page.clock.runFor(30000);
  assert.equal(
    await page.evaluate(() => window.createdPeers),
    attempts,
    "Failed ICE must not create endless replacement connections",
  );
  await page.evaluate(() => window.closeTestAudio());
  console.log(
    "PASS: WebRTC construction errors surface immediately, the microphone is disabled on setup failure, and repeated ICE failures stop at the shared deadline",
  );
} finally {
  await browser.close();
}
