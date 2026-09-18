// AudioWorklet processor for downsampling microphone input to 8000Hz G.711 mu-law chunks
class LiveAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.targetSampleRate = 8000;
    this.chunkSize = 320; // 320 samples at 8kHz = 40ms frame
    this.mulawBuffer = new Uint8Array(this.chunkSize);
    this.mulawIndex = 0;
    this.volumeTick = 0;
  }

  // Fast ITU-T G.711 mu-law encoder
  encodeMuLaw(sample) {
    const BIAS = 132;
    const CLIP = 32635;
    let pcm = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
    let sign = pcm < 0 ? 0x80 : 0;
    if (sign) pcm = -pcm;
    if (pcm > CLIP) pcm = CLIP;
    pcm += BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; expMask >>= 1) {
      exponent--;
    }
    let mantissa = (pcm >> (exponent + 3)) & 0x0f;
    return (~(sign | (exponent << 4) | mantissa)) & 0xff;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0];
    const inputSampleRate = currentFrame ? sampleRate : 48000;

    // Resample from native rate down to 8000Hz
    const ratio = inputSampleRate / this.targetSampleRate;
    let sumSq = 0;

    for (let i = 0; i < channelData.length; i += ratio) {
      const idx = Math.floor(i);
      const sample = channelData[idx] || 0;
      sumSq += sample * sample;

      this.mulawBuffer[this.mulawIndex++] = this.encodeMuLaw(sample);

      if (this.mulawIndex >= this.chunkSize) {
        // Send full 320-byte 40ms frame
        const chunkToSend = this.mulawBuffer.slice(0, this.chunkSize);
        this.port.postMessage({
          type: "audio_data",
          buffer: chunkToSend.buffer,
        }, [chunkToSend.buffer]);

        this.mulawBuffer = new Uint8Array(this.chunkSize);
        this.mulawIndex = 0;
      }
    }

    // Report mic volume level every few blocks (~60Hz)
    this.volumeTick++;
    if (this.volumeTick % 4 === 0) {
      const rms = Math.sqrt(sumSq / (channelData.length / ratio || 1));
      this.port.postMessage({
        type: "volume",
        volume: Math.min(1, rms * 5),
      });
    }

    return true;
  }
}

registerProcessor("live-audio-processor", LiveAudioProcessor);
