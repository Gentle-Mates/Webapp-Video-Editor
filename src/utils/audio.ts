import { Mp3Encoder } from '@breezystack/lamejs';

const TARGET_SAMPLE_RATE = 16000;
const MP3_BITRATE = 128;

export async function extractAudioFromVideo(videoFile: File): Promise<File> {
    const arrayBuffer = await videoFile.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const mono = new Float32Array(audioBuffer.length);

    for (let i = 0; i < audioBuffer.length; i++) {
        let sum = 0;

        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            sum += audioBuffer.getChannelData(ch)[i];
        }

        mono[i] = sum / audioBuffer.numberOfChannels;
    }

    const resampledLength = Math.round((audioBuffer.length * TARGET_SAMPLE_RATE) / audioBuffer.sampleRate);
    const resampled = new Float32Array(resampledLength);

    for (let i = 0; i < resampledLength; i++) {
        const srcIndex = (i * audioBuffer.sampleRate) / TARGET_SAMPLE_RATE;
        const idx = Math.floor(srcIndex);
        const frac = srcIndex - idx;

        const s0 = mono[idx] ?? 0;
        const s1 = mono[Math.min(idx + 1, audioBuffer.length - 1)] ?? 0;

        resampled[i] = s0 + frac * (s1 - s0);
    }

    const samples = new Int16Array(resampledLength);

    for (let i = 0; i < resampledLength; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));

        samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const encoder = new Mp3Encoder(1, TARGET_SAMPLE_RATE, MP3_BITRATE);
    const mp3Parts: Uint8Array[] = [];

    for (let i = 0; i < samples.length; i += 1152) {
        const chunk = samples.subarray(i, i + 1152);
        const encoded = encoder.encodeBuffer(chunk);

        if (encoded.length > 0) {
            mp3Parts.push(encoded);
        }
    }

    const last = encoder.flush();

    if (last.length > 0) {
        mp3Parts.push(last);
    }

    await audioContext.close();

    const mp3Data = new Uint8Array(mp3Parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;

    for (const part of mp3Parts) {
        mp3Data.set(part, offset);
        offset += part.length;
    }

    const audioFileName = videoFile.name.replace(/\.[^.]+$/, '.mp3');

    return new File([mp3Data.buffer], audioFileName, { type: 'audio/mpeg' });
}
