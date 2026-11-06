import Phaser from 'phaser';
import { gameConfig } from './game/config';
import './style.css';

const game = new Phaser.Game(gameConfig);

if (import.meta.env.DEV) {
  (window as Window & { __phaserGame?: Phaser.Game }).__phaserGame = game;
}
