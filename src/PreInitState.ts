import * as Phaser from "phaser";

import { baseURL } from "./constants/loading";

const sceneConfig: Phaser.Types.Scenes.SettingsConfig = {
  active: false,
  key: "PreInitState",
  visible: false,
};

export default class PreInitState extends Phaser.Scene {
  public constructor() {
    super(sceneConfig);
  }

  public preload(): void {
    // Set base url
    this.load.baseURL = baseURL;
    this.load.image("img_load", "assets/img/icon_solitaire.png");
    this.load.image("init_bg","assets/img/background.png" )
    this.load.image("button","assets/img/button.png");
    this.load.image("menu","assets/img/menu.png");
    this.load.image("option","assets/img/gear.png");
    this.load.audio("card_drop","assets/sfx/place_card.wav");
    this.load.audio("card_success","assets/sfx/foundation_sound.wav");
    this.load.audio("card_shuffle","assets/sfx/shuffle.wav");
    this.load.audio("win_sound","assets/sfx/win_sound.wav");
    this.load.audio("game_over","assets/sfx/game_over.wav");
    this.load.image("you_win","assets/img/you_win.png");
    this.load.image("stats","assets/img/stats.png");
    this.load.image("undo","assets/img/undo.png");
    this.load.image("undo2","assets/img/undo_2.png");
    this.load.image("redeal","assets/img/redeal.png");
    this.load.image("newDeal","assets/img/newDeal.png");
    this.load.image("gameover","assets/img/gameover.png");
    this.load.image("hint","assets/img/hint.png");
    this.load.image("buttonBG","assets/img/buttonBG.png");//
    this.load.image("playnow","assets/img/playnow.png");
    this.load.image("autocomplete","assets/img/autocomplete.png");
    this.load.atlas("particles","assets/img/match3.png","assets/img/match3.json");




    
  }

  public create(): void {
    this.scene.start("InitState");
  }
}
