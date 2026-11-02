/* ============================================================
   职面通 · 副语言（paralinguistic）实时分析
   ------------------------------------------------------------
   纯浏览器端信号分析，零额外 API：在语音回答时，对正在发送的
   16kHz PCM 音频流逐帧计算语速、停顿、音量稳定度，并从转写文本
   里统计填充词。供实时面板与最终报告使用。
   ============================================================ */
const Paralinguistic = (() => {
  'use strict';

  const RATE = 16000;
  const THRESHOLD = 0.015;   // RMS 能量阈值：高于此值算「发声」
  const PAUSE_MIN = 300;     // 静音 ≥ 300ms 才算一次停顿
  const FILLERS = ['嗯', '呃', '额', '啊', '那个', '就是', '然后', '这个', '哦'];

  let speechSamples = 0;     // 有效发声样本数
  let totalSamples = 0;      // 总样本数
  let pauseSamples = 0;      // 累计停顿时长（样本）
  let pauses = 0;            // 停顿次数
  let inSpeech = false;      // 当前是否在发声
  let curPause = 0;          // 当前静音段累计样本
  let eSum = 0, eSumSq = 0, eN = 0;   // 能量统计（算音量稳定度）
  let fillers = 0;           // 填充词次数
  let chars = 0;             // 转写有效字数

  function reset() {
    speechSamples = totalSamples = pauseSamples = pauses = curPause = 0;
    eSum = eSumSq = eN = fillers = chars = 0;
    inSpeech = false;
  }

  /** 逐帧喂入 Float32 PCM（每个 ScriptProcessor chunk 调一次） */
  function addFrame(f32) {
    const n = f32.length;
    let sq = 0;
    for (let i = 0; i < n; i++) sq += f32[i] * f32[i];
    const rms = Math.sqrt(sq / n);
    totalSamples += n;
    eSum += rms; eSumSq += rms * rms; eN++;

    const speaking = rms > THRESHOLD;
    if (speaking) {
      speechSamples += n;
      // 之前一段静音够长，记一次停顿
      if (!inSpeech && curPause >= (PAUSE_MIN / 1000) * RATE) {
        pauses++;
        pauseSamples += curPause;
      }
      curPause = 0;
      inSpeech = true;
    } else if (inSpeech) {
      curPause += n;
    }
  }

  /** 喂入转写文本：统计填充词与有效字数 */
  function addTranscript(t) {
    if (!t) return;
    const text = String(t);
    chars += text.replace(/[\s，。！？、；：""''（）()《》.,;:!?\-—…·]/g, '').length;
    for (const f of FILLERS) {
      fillers += (text.match(new RegExp(f, 'g')) || []).length;
    }
  }

  /** 取当前指标快照 */
  function snapshot() {
    const speechMs = speechSamples / RATE * 1000;
    const secs = speechMs / 1000;
    const rate = secs > 0 ? Math.round(chars / secs * 60) : 0;          // 字/分钟
    const avgPause = pauses ? Math.round(pauseSamples / pauses / RATE * 1000) : 0;  // ms
    const mean = eN ? eSum / eN : 0;
    const variance = eN > 1 ? Math.max(0, eSumSq / eN - mean * mean) : 0;
    const volumeStability = mean > 0 ? Math.round(Math.max(0, 1 - Math.sqrt(variance) / mean) * 100) : 100;
    return {
      rate, pauses, avgPause, fillers, volumeStability,
      speechMs: Math.round(speechMs), chars,
    };
  }

  return { reset, addFrame, addTranscript, snapshot };
})();

window.Paralinguistic = Paralinguistic;
