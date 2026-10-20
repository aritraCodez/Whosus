export type VoicePeer = { id: string; gain: number; sendGain: number };
export type VoiceSignal = {
  from: string;
  kind: "offer" | "answer" | "ice" | "reset";
  generation: number;
  sdp?: string;
  candidate?: RTCIceCandidateInit | null;
};
export type Watch = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Float32Array;
};
export type Peer = {
  pc: RTCPeerConnection;
  generation: number;
  source: MediaStreamAudioSourceNode;
  gate: GainNode;
  destination: MediaStreamAudioDestinationNode;
  audio: HTMLAudioElement;
  queue: (RTCIceCandidateInit | null)[];
  signals: Promise<void>;
  blocked: boolean;
  failed: boolean;
  retry?: ReturnType<typeof setTimeout>;
  timeout?: ReturnType<typeof setTimeout>;
  deadline: number;
};

