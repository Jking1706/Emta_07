import Phaser from 'phaser';
import type { Player } from '../player/Player';

export type DialogueOptions = {
  name: string;
  portrait?: string;
  messages: string[];
  choices?: Array<{ label: string; onSelect: () => void }>;
};

export class DialogSystem {
  private box: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  private hideEvent?: Phaser.Time.TimerEvent;
  private dialogue!: Phaser.GameObjects.Container;
  private dialogueName!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private portraitFallback!: Phaser.GameObjects.Text;
  private continueHint!: Phaser.GameObjects.Text;
  private spaceKey: Phaser.Input.Keyboard.Key;
  private messages: string[] = [];
  private messageIndex = 0;
  private visibleCharacters = 0;
  private typeAccumulator = 0;
  private lastTypeTime = 0;
  private readonly typeSpeed = 18;
  private active = false;
  private scene: Phaser.Scene;
  private player?: Player;
  private choices: NonNullable<DialogueOptions['choices']> = [];
  private choiceViews: Phaser.GameObjects.Text[] = [];
  private selectedChoice = 0;
  private upKey: Phaser.Input.Keyboard.Key;
  private downKey: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, player?: Player) {
    this.scene = scene;
    this.player = player;
    this.box = scene.add
      .rectangle(480, 346, 660, 76, 0x231927, 0.94)
      .setStrokeStyle(2, 0xd8c9a3)
      .setScrollFactor(0)
      .setDepth(9000)
      .setVisible(false);

    this.text = scene.add
      .text(480, 346, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#efe0b3',
        align: 'center',
        wordWrap: { width: 604 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9001)
       .setVisible(false);

    this.spaceKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.upKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.createDialogueWindow();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hideEvent?.remove(false);
      this.active = false;
      this.player?.setControlsEnabled(true);
    });
  }

  show(message: string) {
    if (this.active) return;
    this.hideEvent?.remove(false);
    this.box.setVisible(true);
    this.text.setText(message).setVisible(true);
    this.hideEvent = this.box.scene.time.delayedCall(2400, () => this.hide());
  }

  hide() {
    this.box.setVisible(false);
    this.text.setVisible(false);
  }

  showDialogue({ name, portrait, messages, choices = [] }: DialogueOptions) {
    if (messages.length === 0) {
      return;
    }

    this.hideEvent?.remove(false);
    this.clearChoices();
    this.choices = choices.slice(0, 3);
    this.selectedChoice = 0;
    Phaser.Input.Keyboard.JustDown(this.spaceKey);
    this.hide();
    this.active = true;
    this.messages = [...messages];
    this.messageIndex = 0;
    this.dialogueName.setText(name);
    this.setPortrait(portrait, name);
    this.player?.setControlsEnabled(false);
    this.scene.tweens.killTweensOf(this.dialogue);
    this.dialogue.setVisible(true).setAlpha(0);
    this.pinDialogueToCamera();
    this.scene.tweens.add({ targets: this.dialogue, alpha: 1, duration: 160, ease: 'Quad.Out' });
    this.startMessage();
  }

  update(interact = false) {
    if (!this.active) {
      return false;
    }

    this.pinDialogueToCamera();

    const up = Phaser.Input.Keyboard.JustDown(this.upKey);
    const down = Phaser.Input.Keyboard.JustDown(this.downKey);
    const space = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    if (this.choiceViews.length) {
      if (up || down) { this.selectedChoice = (this.selectedChoice + (down ? 1 : -1) + this.choices.length) % this.choices.length; this.paintChoices(); }
    } else if (!interact && !space) {
      this.advanceTypewriter();
    }
    if (interact || space) {
      if (this.choiceViews.length) {
        this.choose(this.selectedChoice);
      } else if (this.visibleCharacters < this.messages[this.messageIndex].length) {
        this.completeMessage();
      } else {
        this.advance();
      }
    }

    return true;
  }

  get isActive() {
    return this.active;
  }

  destroy() {
    this.clearChoices();
    this.hideEvent?.remove(false);
    this.scene.tweens.killTweensOf([this.dialogue, this.continueHint]);
    this.box.destroy(); this.text.destroy(); this.dialogue.destroy(true);
    this.active = false;
  }

  private createDialogueWindow() {
    const panel = this.scene.add.rectangle(0, 0, 836, 138, 0x15121d, 0.96).setStrokeStyle(2, 0xd8c9a3);
    const inner = this.scene.add.rectangle(0, 0, 824, 126, 0x30243d, 0.7).setStrokeStyle(1, 0x806b8d, 0.7);
    const portraitFrame = this.scene.add.rectangle(-350, 0, 104, 104, 0x101219, 1).setStrokeStyle(2, 0xf0b35a);
    this.portrait = this.scene.add.image(-350, 0, '__MISSING').setDisplaySize(82, 82).setVisible(false);
    this.portraitFallback = this.scene.add.text(-350, 0, '?', { fontFamily: 'Georgia, serif', fontSize: '44px', color: '#f1d88a' }).setOrigin(0.5);
    this.dialogueName = this.scene.add.text(-288, -54, '', { fontFamily: 'Georgia, serif', fontSize: '17px', color: '#f1d88a', backgroundColor: '#231927' }).setPadding(8, 3);
    this.dialogueText = this.scene.add.text(-286, -19, '', { fontFamily: 'Georgia, serif', fontSize: '16px', color: '#f5edd5', wordWrap: { width: 600 }, lineSpacing: 5 });
    this.continueHint = this.scene.add.text(382, 49, '▼ Presiona E o Espacio para continuar', { fontFamily: 'Georgia, serif', fontSize: '11px', color: '#f1d88a' }).setOrigin(1, 1);
    this.dialogue = this.scene.add.container(0, 0, [panel, inner, portraitFrame, this.portrait, this.portraitFallback, this.dialogueName, this.dialogueText, this.continueHint])
      .setDepth(10000)
      .setVisible(false);
    this.scene.tweens.add({ targets: this.continueHint, alpha: 0.35, duration: 550, yoyo: true, repeat: -1 });
  }

  private startMessage() {
    this.typeAccumulator = 0;
    this.lastTypeTime = 0;
    this.visibleCharacters = 0;
    this.dialogueText.setText('');
    this.continueHint.setVisible(false);
    const message = this.messages[this.messageIndex];

    if (message.length === 0) {
      this.continueHint.setVisible(true);
      this.showChoicesOnLast();
    }
  }

  /** Typed text follows wall-clock time, so low frame rates do not slow it to a crawl. */
  private advanceTypewriter() {
    const message = this.messages[this.messageIndex];
    if (this.visibleCharacters >= message.length) return;
    const now = performance.now();
    const delta = this.lastTypeTime === 0 ? 0 : Math.min(now - this.lastTypeTime, 250);
    this.lastTypeTime = now;
    this.typeAccumulator += delta;
    const step = Math.floor(this.typeAccumulator / this.typeSpeed);
    if (step <= 0) return;
    this.typeAccumulator -= step * this.typeSpeed;
    this.visibleCharacters = Math.min(message.length, this.visibleCharacters + step);
    this.dialogueText.setText(message.slice(0, this.visibleCharacters));
    this.continueHint.setVisible(this.visibleCharacters === message.length);
    if (this.visibleCharacters === message.length) this.showChoicesOnLast();
  }

  private completeMessage() {
    this.typeAccumulator = 0;
    this.visibleCharacters = this.messages[this.messageIndex].length;
    this.dialogueText.setText(this.messages[this.messageIndex]);
    this.continueHint.setVisible(true);
    this.showChoicesOnLast();
  }

  private showChoicesOnLast() {
    if (this.messageIndex === this.messages.length - 1 && this.choices.length) this.showChoices();
  }

  private showChoices() {
    if (this.choiceViews.length) return;
    this.choices.forEach((choice, i) => {
      const view = this.scene.add.text(-390, -98 - (this.choices.length - 1 - i) * 38, choice.label, {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#f5edd5', backgroundColor: '#30243d', align: 'center',
      }).setFixedSize(780, 32).setPadding(0, 7).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      view.on('pointerdown', () => this.choose(i));
      view.on('pointerover', () => { this.selectedChoice = i; this.paintChoices(); });
      this.dialogue.add(view); this.choiceViews.push(view);
    });
    this.paintChoices();
    this.continueHint.setText('↑ ↓ elegir · E confirmar · o pulsa una respuesta');
  }

  private paintChoices() {
    this.choiceViews.forEach((view, i) => view.setBackgroundColor(i === this.selectedChoice ? '#5c6d4f' : '#30243d'));
  }

  private advance() {
    if (this.messageIndex < this.messages.length - 1) {
      this.messageIndex++;
      this.startMessage();
      return;
    }

    if (this.choices.length) {
      this.showChoices();
      return;
    }
    this.close();
  }

  private clearChoices() {
    this.choiceViews.forEach(view => view.destroy());
    this.choiceViews = [];
    this.continueHint?.setText('▼ Presiona E o Espacio para continuar');
  }

  private choose(index: number) {
    if (!this.active || !this.choiceViews.length) return;
    const callback = this.choices[index]?.onSelect;
    this.clearChoices(); this.choices = [];
    this.close();
    callback?.();
  }

  private close() {
    this.active = false;
    this.player?.setControlsEnabled(true);
    this.scene.tweens.add({ targets: this.dialogue, alpha: 0, y: '+=12', duration: 120, onComplete: () => this.dialogue.setVisible(false).setY(0) });
  }

  private setPortrait(portrait: string | undefined, name: string) {
    const hasPortrait = Boolean(portrait && this.scene.textures.exists(portrait));
    this.portrait.setVisible(hasPortrait);
    this.portraitFallback.setVisible(!hasPortrait).setText(name.charAt(0).toUpperCase() || '?');

    if (hasPortrait && portrait) {
      this.portrait.setTexture(portrait).setFrame(0);
      this.portrait.setScale(Math.min(88 / this.portrait.width, 88 / this.portrait.height));
    }
  }

  private pinDialogueToCamera() {
    const camera = this.scene.cameras.main;
    this.dialogue.setPosition(camera.scrollX + camera.width / 2, camera.scrollY + camera.height / 2 + (camera.height / 2 - 85) / camera.zoom);
    this.dialogue.setScale(1 / camera.zoom);
  }
}
