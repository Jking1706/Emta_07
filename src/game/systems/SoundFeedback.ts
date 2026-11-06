import Phaser from 'phaser';

export class SoundFeedback {
  static muted = false;
  static play(scene: Phaser.Scene, kind: 'tool' | 'water' | 'reward' | 'talk' | 'music') {
    if (this.muted || !('context' in scene.sound)) return;
    const context = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
    if (context.state !== 'running') { void context.resume().catch(() => {}); return; }
    const notes = kind === 'music' ? [262, 330, 392, 523, 392, 330] : kind === 'reward' ? [523, 659] : [kind === 'water' ? 740 : kind === 'talk' ? 330 : 140];
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const start = context.currentTime + i * .16;
      oscillator.type = kind === 'tool' ? 'triangle' : 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .01);
      gain.gain.exponentialRampToValueAtTime(.001, start + .13);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start); oscillator.stop(start + .15);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
}
