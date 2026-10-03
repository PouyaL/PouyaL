const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null

export function stopSpeech() {
  try { synth?.cancel() } catch { /* speech is best-effort */ }
}

/** Speaks `text`, resolving when finished, or when `cancelled()` turns true. Falls back to a timed delay if speech is unavailable. */
export function say(text: string, cancelled: () => boolean): Promise<void> {
  const est = Math.max(1100, text.length * 58)
  return new Promise((resolve) => {
    let done = false
    const fin = () => { if (!done) { done = true; clearInterval(chk); clearTimeout(guard); resolve() } }
    const guard = setTimeout(fin, synth ? est * 2.2 : est)
    if (synth) {
      try {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'en-US'
        u.onend = () => setTimeout(fin, 180)
        synth.speak(u)
        setTimeout(() => { if (!synth.speaking && !done) setTimeout(fin, est) }, 400)
      } catch { /* fall back to the timer */ }
    }
    const chk = setInterval(() => { if (cancelled()) fin() }, 120)
  })
}
