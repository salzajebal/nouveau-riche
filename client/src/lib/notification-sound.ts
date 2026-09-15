let notificationAudioContext: AudioContext | null = null;

function getNotificationAudioContext(): AudioContext {
  if (!notificationAudioContext) {
    notificationAudioContext = new AudioContext();
  }
  return notificationAudioContext;
}

export async function unlockNotificationSound(): Promise<void> {
  const context = getNotificationAudioContext();
  if (context.state === "suspended") {
    await context.resume();
  }
}

export async function playNotificationSound(): Promise<void> {
  try {
    await unlockNotificationSound();
    const context = getNotificationAudioContext();
    if (context.state !== "running") return;

    const playBeep = (frequency: number, start: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
      gain.gain.setValueAtTime(0.25, context.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + start + duration);
      oscillator.start(context.currentTime + start);
      oscillator.stop(context.currentTime + start + duration);
    };

    playBeep(880, 0, 0.15);
    playBeep(1100, 0.18, 0.15);
    playBeep(1320, 0.36, 0.25);
  } catch (error) {
    console.warn("알림음을 재생하지 못했습니다.", error);
  }
}