/**
 * AudioWorklet processor for capturing PCM audio from the microphone.
 * Runs on a dedicated audio thread to avoid blocking the main thread.
 *
 * This file must be served as a static asset — it's loaded via
 * audioContext.audioWorklet.addModule('/pcm-capture-processor.js').
 */

class PcmCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, _outputs, _parameters) {
        const input = inputs[0];
        if (input && input.length > 0 && input[0].length > 0) {
            // Copy the Float32 channel data and send it to the main thread
            const channelData = input[0];
            this.port.postMessage(channelData, [channelData.buffer]);
        }
        return true; // Keep the processor alive
    }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
