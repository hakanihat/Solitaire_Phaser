import * as Phaser from "phaser";
import 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import Deck from "./Deck";
import Card from "./Card";
import { ALL_PILES, FOUNDATION_PILES, PileId, TABLEAU_PILES, TOTAL_PILES } from "./constants/table";
import { CARD_DIMENSIONS, STACK_DRAG_OFFSET, SUIT_COLOR } from "./constants/deck";
import { Pile } from "./Pile";
import HintSystem from "./HintSystem";
import { AutoComplete } from "./AutoComplete";
import BackstepSystem, { BackstepData } from "./BackStepSystem";
import { GameStorage } from "./GameStorage";
import { App } from '@capacitor/app';
import { AdMob } from "@capacitor-community/admob";
import ToggleSwitch from 'phaser3-rex-plugins/plugins/toggleswitch.js';
import UIPlugin from "phaser3-rex-plugins/templates/ui/ui-plugin.js";
import ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./constants/screen";

const sceneConfig: Phaser.Types.Scenes.SettingsConfig = {
  active: false,
  key: "GameState",
  visible: false,
  
};

const createPanel = function (scene: Phaser.Scene, toggleSwitches: ToggleSwitch[]) {
  // Create container for the toggle switch
  var switchContainer = scene.add.container()
    .add(toggleSwitches)
    .setSize(SCREEN_WIDTH/1.8, SCREEN_HEIGHT/12);  // Adjusted width

  // Add "Left-Handed" text on the left side of the toggle switch
  const leftHandedText = scene.add.text(SCREEN_WIDTH/10.8, SCREEN_HEIGHT/34.29, 'Left-Handed:', {
    fontSize: SCREEN_WIDTH/15,
    color: '#000000',
    fontStyle: 'bold'
  });

  const hitCardText = scene.add.text(SCREEN_WIDTH/10.8, SCREEN_HEIGHT/10.9, 'Move by tapping:', {
    fontSize:  SCREEN_WIDTH/20,
    color: '#000000',
    fontStyle: 'bold'
  });
  for(let i=0; i<toggleSwitches.length;i++){
    toggleSwitches[i].setPosition(SCREEN_WIDTH-(SCREEN_WIDTH/4.32) , switchContainer.height / 2+i*(SCREEN_HEIGHT/16));

  }
  switchContainer.add(leftHandedText);
  switchContainer.add(hitCardText);
  return switchContainer;
};

export default class GameState extends Phaser.Scene {
  public static interstitial_freq: number;
  static isHitMoveEnabled: boolean = true;
  [x: string]: any;
  public score: number = 0;
  public static highscore: number = 0;
  public static shortestTime: number = 99999;
  public static totalTime: number = 0;
  public static isLeftHanded:boolean = false;
  private dragChildren: Card[] = [];
  private rexUI!: UIPlugin;
  public  deck!: Deck;

  private scoreText!: Phaser.GameObjects.Text;
  public finalScoreText!: Phaser.GameObjects.Text;
  private finalTimeText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  public static highScoreStatText: Phaser.GameObjects.Text;
  public static shortestTimeText: Phaser.GameObjects.Text;
  public static totalTimeText: Phaser.GameObjects.Text;
 
  private scaleTween?: Phaser.Tweens.Tween;
  public static emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private autoCompleteButton!:any;
  private elapsedTime: number = 0;
  private back_image!: Phaser.GameObjects.Image;
  public win_image!: Phaser.GameObjects.Image;
  public gameoverimage!: Phaser.GameObjects.Image;
  private backButton!: Phaser.GameObjects.Image;
  private buttonBG!: Phaser.GameObjects.Image;
  public stats!: Phaser.GameObjects.Image;
  public hintSystem!: HintSystem;
  private autoComplete!: AutoComplete;
  private backStepSystem!: BackstepSystem;
  public static undoButton: Phaser.GameObjects.Image;
  private optionButton!: Phaser.GameObjects.Image;
  private menuButton!: Phaser.GameObjects.Image;
  public otherGameButton!: Phaser.GameObjects.Image;
  public otherGameButton2!: Phaser.GameObjects.Image;
  public otherGameButton3!: Phaser.GameObjects.Image;
  private timerText!: Phaser.GameObjects.Text;
  public static hintText: Phaser.GameObjects.Text;
  public static hintButton: Phaser.GameObjects.Image
  public newDealButton!: Phaser.GameObjects.Image
  public redealButton!: Phaser.GameObjects.Image
  public timerEvent!: Phaser.Time.TimerEvent;
  private dropSound!: Phaser.Sound.BaseSound;
  private successSound!: Phaser.Sound.BaseSound;
  private shuffleSound!: Phaser.Sound.BaseSound;
  private winSound!: Phaser.Sound.BaseSound;
  private gameOverSound!: Phaser.Sound.BaseSound;
  private static instance: GameState | null = null;
  private myFlag: boolean = true;
  private toggleswitch!: ToggleSwitch;
  private toggleHitCard!: ToggleSwitch;
  private panel!: ScrollablePanel;
  public constructor() {
    super(sceneConfig);
    this.hintSystem = new HintSystem(this);
    this.autoComplete = new AutoComplete(this);
    this.backStepSystem = new BackstepSystem();
  }

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  public preload() { 

    this.load.scenePlugin('rexuiplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexuiplugin.min.js', 'rexUI', 'rexUI');

      this.load.scenePlugin({
          key: 'rexuiplugin',
          url: 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexuiplugin.min.js',
          sceneKey: 'rexUI'
      });
    
      this.load.bitmapFont('gothic', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/assets/fonts/gothic.png', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/assets/fonts/gothic.xml');
  }
 
  public create(): void {
  
    // Game state variables
    console.log("En cekici: height: "+ CARD_DIMENSIONS.height+ " width: "+ CARD_DIMENSIONS.width);
    this.score = 0;
    this.dragChildren = [];
    this.dropSound = this.sound.add("card_drop",{volume : 4});
    this.successSound = this.sound.add("card_success" ,{volume:2});
    this.shuffleSound = this.sound.add("card_shuffle",{volume:3});
    this.winSound = this.sound.add("win_sound",{volume:1});
    this.gameOverSound = this.sound.add("game_over",{volume:12});

    this.toggleswitch = new ToggleSwitch(this, 0, 0, SCREEN_WIDTH/3.6, SCREEN_HEIGHT/12, 0x508D69);
    this.toggleswitch.setDepth(90).setInteractive({priority:99});

  this.toggleHitCard = new ToggleSwitch(this, 0, 0, SCREEN_WIDTH/3.6, SCREEN_HEIGHT/12, 0x508D69);
  this.toggleHitCard.setDepth(90).setInteractive({priority:99});

    this.panel = this.rexUI.add.scrollablePanel({
      x: (SCREEN_WIDTH + 100) / 2,
      y: SCREEN_HEIGHT / 2,
      width: (SCREEN_WIDTH + 100) / 1.1,
      height: SCREEN_HEIGHT  / 1.3,
      scrollMode: 'y',
      background:  this.rexUI.add.roundRectangle(0, 0, 20, 10, 10, 0xc3e0ce),
      panel: {
          child: createPanel(this,[this.toggleswitch,this.toggleHitCard]),  // Pass the toggleSwitch instance
          mask: { padding: 1,
            updateMode: 0},
      },
      slider: {
          track: this.rexUI.add.roundRectangle(0, 0, 20, 10, 10, 0x2f4938),  // Black track
          thumb: this.rexUI.add.roundRectangle(0, 0, 20, 20, 13, 0x35724d),  // White thumb
      },
      mouseWheelScroller: {
          focus: true,
          speed: 0.1,
          
          
      },
      header: this.rexUI.add.label({
          height: 100,
          background: this.rexUI.add.roundRectangle(0, 0, 2, 15, 10, 0x35724d),
          text: this.add.text(0, 0, 'OPTION PANEL', {
              fontSize: 50,
              color: '#ffffff',
              align: 'center',  // Centered text
              fixedWidth: (SCREEN_WIDTH + 100) / 1.1,  // Fixed width to center text
              fontStyle: 'bold',  // Bold text
          }),
          
      }),
      footer: this.rexUI.add.imageBox(0,0,undefined,undefined,{
        height:SCREEN_HEIGHT/8,
        width:SCREEN_WIDTH/3.6,
        background: this.rexUI.add.roundRectangle(0, 0, 2, 2, 40, 0x35724d),
        image: this.add.image(0, 0, "undo2").setInteractive().setVisible(true).setDepth(51).on("pointerdown",()=>{
          this.input.setTopOnly(true);
            GameState.hintButton.setInteractive();  
            GameState.undoButton.setInteractive(); 
            this.newDealButton.setInteractive(); 
            this.redealButton.setInteractive(); 
            this.menuButton.setInteractive();
            this.deck.makeAllCardsActive();
            this.panel.setVisible(false);
        })
      }),
      space: { left: 20, right: 20, top: 20, bottom: 20, panel: 3, header: 5, footer: 5 },
      
  })
  .layout()
  .drawBounds(this.add.graphics(), 0xff0000);
   this.panel.setVisible(false).setDepth(50);

    // Add background
    this.back_image = this.add.image((SCREEN_WIDTH+100) / 2, (SCREEN_HEIGHT) / 2, "img_background");
    this.win_image = this.add.image((SCREEN_WIDTH+100) / 2, (SCREEN_HEIGHT) / 2.2, "you_win");
    this.gameoverimage = this.add.image((SCREEN_WIDTH+100) / 2, (SCREEN_HEIGHT) / 2.2, "gameover");
    this.stats = this.add.image((SCREEN_WIDTH+100) / 2, (SCREEN_HEIGHT) / 2.2, "stats");
    this.backButton = this.add.image((SCREEN_WIDTH+100) / 2, (SCREEN_HEIGHT) / 2 + 475, "undo");
    this.buttonBG = this.add.image((SCREEN_WIDTH) / 2+50, (SCREEN_HEIGHT) / 1.145, "buttonBG");
    
    this.buttonBG.setScale(SCREEN_WIDTH/1895,SCREEN_HEIGHT/4000);
    this.backButton.setDepth(51).setVisible(false).setScale(SCREEN_WIDTH/2160);
    this.stats.setDepth(50).setVisible(false).setScale(SCREEN_WIDTH/771.5);
    this.win_image.setDepth(50).setVisible(false).setScale(SCREEN_WIDTH/1500);    
    this.back_image.setScale((SCREEN_WIDTH+100)/ this.back_image.width ,SCREEN_HEIGHT/ this.back_image.height);
    this.gameoverimage.setVisible(false).setDepth(50).setScale(SCREEN_WIDTH/750);
  

    this.deck = new Deck(this);
    this.createZones();
    this.createInputListeners();
    this.createButtons();
    this.createText();
    this.createTimer();
    this.initializeStats();
    this.hintSystem.handleUserActivity();
    Card.giveMeHint(this.hintSystem);
  }

  private async initializeStats() {
    await GameStorage.loadHighscore();
    await GameStorage.loadShortestGameTime();
    await GameStorage.loadTotalGameplayTime();
    await GameStorage.loadInterstitialValue();
    this.toggleswitch.value = GameState.isLeftHanded;
    this.toggleHitCard.value = GameState.isHitMoveEnabled;
    this.toggleswitch.on('valuechange', () => {
      console.log("This is from left-handed switch (before) : isLeftHanded- "+GameState.isLeftHanded+ " Tapactive:- "+GameState.isHitMoveEnabled);
      GameState.isLeftHanded = !GameState.isLeftHanded;
      console.log("This is from left-handed switch (after) : isLeftHanded- "+GameState.isLeftHanded+ " Tapactive:- "+GameState.isHitMoveEnabled);

      this.events.emit('updateLeftHanded', GameState.isLeftHanded);
  })
    this.toggleHitCard.on('valuechange', () => {
      console.log("This is from left-handed switch (before) : isLeftHanded- "+GameState.isLeftHanded+ " Tapactive:- "+GameState.isHitMoveEnabled);

      GameState.isHitMoveEnabled = !GameState.isHitMoveEnabled;
      console.log("This is from left-handed switch (after) : isLeftHanded- "+GameState.isLeftHanded+ " Tapactive:- "+GameState.isHitMoveEnabled);

      if(GameState.isHitMoveEnabled){
        this.deck.activateTapMode();
      }
  })

    console.log("Eto kakvo se sluchva: " + GameState.highscore + " | " + GameState.shortestTime + " | " + GameState.totalTime);
    GameState.highScoreStatText.text = GameState.highscore.toString();
    GameState.shortestTimeText.text = this.formatTime(GameState.shortestTime);
    GameState.totalTimeText.text = this.formatTime(GameState.totalTime);

    App.addListener('appStateChange', async (state) => {
        if (!state.isActive) {
            await GameStorage.saveTotalGameplayTime(this.elapsedTime + GameState.totalTime);
            await GameStorage.saveInterstitialValue(GameState.interstitial_freq);
            await GameStorage.saveLeftHanded(GameState.isLeftHanded);
            await GameStorage.saveTapCard(GameState.isHitMoveEnabled);
        }
    });
}

  public gameOver():void{
    document.removeEventListener('touchstart', this.hintSystem.handleUserActivity);
    if(this.hintSystem.timeoutId){
      clearTimeout(this.hintSystem.timeoutId);
      this.hintSystem.timeoutId = null;

    }
    this.gameoverimage.setVisible(true);
    this.otherGameButton.setVisible(true);
    this.gameOverSound.play();
    GameState.hintButton.disableInteractive();  
    GameState.undoButton.disableInteractive();
    this.optionButton.disableInteractive();
    this.menuButton.disableInteractive();
    this.deck.makeAllCardsInactive();
      this.buttonScale([this.newDealButton,this.redealButton]);
        GameStorage.saveTotalGameplayTime(this.elapsedTime+ GameState.totalTime);
    if (this.timerEvent) {
      this.timerEvent.remove(false); // The 'false' parameter means the timer event won't execute the callback if it's currently running
    }
    
  }

  private buttonScale(btn: Phaser.GameObjects.Image[]):void{
      this.scaleTween = this.tweens.add({
        targets: btn,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 500,
        ease: 'Linear',
        repeat: -1,
        yoyo: true,
      });
    
    
  }
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  private resetTimer(): void {
    this.elapsedTime = 0;
    this.timerText.setText('0:00:00');
}

  public createTimer(): void {
  const scaleWidth = SCREEN_WIDTH / 13;

  this.timerText = this.add.text(SCREEN_WIDTH / 3.5, SCREEN_HEIGHT/48, '',
   { font: `${scaleWidth}px Arial`,
    color: "#FFF"
  });
  

    this.timerEvent= this.time.addEvent({
      delay: 1000, // 1 second (in milliseconds)
      callback: this.updateElapsedTime,
      callbackScope: this,
      loop: true,
  });
  
  }

  private updateElapsedTime(): void {
    this.elapsedTime += 1;
}

  public createZones(): void {
    Object.values(PileId).forEach((pileId) => {
      const pile = new Pile(this, pileId);
      this.add.existing(pile);

      // Draw zone
      if (pile.pileId === PileId.Stock) {
        pile.on(
          "pointerdown",
          () => {
            if(!this.gameoverimage.visible && !this.win_image.visible && !this.stats.visible && !this.panel.visible)
            this.drawCard();
          },
          this
        );
        pile.setDepth(99);
      }
    });
  }

  public createInputListeners(): void {
  
    // Start drag card
    this.input.on(
      "dragstart",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject
      ) => {
        if (gameObject instanceof Card) {
              this.dragCardStart(gameObject);          
        }
      },
      this
    );
  
this.input.on(
  "dragend",
  (
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject
  ) => {
    if (gameObject instanceof Card) {
      this.hintSystem.handleUserActivity();
      const dropZones = ALL_PILES; // Replace with your actual array of drop zones

      for (const dropZone of dropZones) {
        const isOverlapping = Phaser.Geom.Intersects.RectangleToRectangle(
          gameObject.getBounds(),
          this.getPileById(dropZone)!.getBounds()
         );

         if(gameObject.pile !== gameObject.currentPile){
          break;
        }
        if (isOverlapping && gameObject.pile !== dropZone) {
          this.dropCard(gameObject, this.getPileById(dropZone)!,false);  
        }
      
      }
      if(gameObject.pile === gameObject.currentPile){

        this.repositionCard(gameObject,this.getPileById(gameObject.currentPile)!);
        
      }   
    }
  },
  this
);

  
    // Drag card
    this.input.on(
      "drag",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number
      ) => {
        if (gameObject instanceof Card) {

          this.dragCard(gameObject, dragX, dragY);
          this.hintSystem.handleUserActivity();

        }
      },
      this
    );
  }
  

  public createButtons(): void {

    this.otherGameButton = this.add.image(SCREEN_WIDTH/1.82,SCREEN_HEIGHT / 2,"playnow")//185
    .setInteractive()
    .setVisible(false)
    .setDepth(51)
    .setScale(SCREEN_WIDTH/750)
    .on(
      "pointerdown",
      () => {
        window.open('https://play.google.com/store/apps/details?id=com.lunagames.speedcards', '_blank');
      },
      this
    )  ;

    this.otherGameButton2 = this.add.image(SCREEN_WIDTH/1.82,SCREEN_HEIGHT / 1.55,"playnow")//185
    .setInteractive()
    .setVisible(false)
    .setDepth(51)
    .setScale(SCREEN_WIDTH/800)
    .on(
      "pointerdown",
      () => {
        window.open('https://play.google.com/store/apps/details?id=com.lunagames.speedcards', '_blank');
      },
      this
    )  ;

    this.otherGameButton3 = this.add.image(SCREEN_WIDTH/1.82,SCREEN_HEIGHT / 1.65,"playnow")//185
    .setInteractive()
    .setVisible(false)
    .setDepth(51)
    .setScale(SCREEN_WIDTH/750)
    .on(
      "pointerdown",
      () => {
        window.open('https://play.google.com/store/apps/details?id=com.lunagames.speedcards', '_blank');
      },
      this
    )  ;

    this.optionButton = this.add.sprite(SCREEN_WIDTH/10.8, SCREEN_HEIGHT/26.67, "option") // 185
    .setInteractive()
    .setDepth(11)
    .on(
      "pointerdown",
      () => {
        setTimeout(() => {
          this.input.setTopOnly(false);
          GameState.hintButton.disableInteractive();  
          GameState.undoButton.disableInteractive();
          this.newDealButton.disableInteractive();
          this.redealButton.disableInteractive();
          this.menuButton.disableInteractive();
          this.deck.makeAllCardsInactive();
          this.panel.setVisible(true);
      }, 1); 
        
          this.panel.onClickOutside((_clickOutside, _pointer) => {
            // Close the panel
            this.input.setTopOnly(true);
            GameState.hintButton.setInteractive();  
            GameState.undoButton.setInteractive(); 
            this.newDealButton.setInteractive(); 
            this.redealButton.setInteractive(); 
            this.menuButton.setInteractive();
            this.deck.makeAllCardsActive();
            this.panel.setVisible(false);
          }, this);
        
      },
      this
    );
  
  this.backButton.on("pointerdown",() => {this.stats.setVisible(false);
    this.otherGameButton3.setVisible(false);
    this.backButton.setVisible(false); 
     GameState.highScoreStatText.setVisible(false);
    GameState.shortestTimeText.setVisible(false);
    GameState.totalTimeText.setVisible(false);
    GameState.hintButton.setInteractive();  
    GameState.undoButton.setInteractive();
    this.optionButton.setInteractive();
    this.redealButton.setInteractive();
    this.newDealButton.setInteractive();
    this.deck.makeAllCardsActive();
  }  )
  this.optionButton.setScale(SCREEN_WIDTH/8500);


  this.menuButton = this.add.image(SCREEN_WIDTH/7.44,SCREEN_HEIGHT / 1.155,"menu")//185
  .setInteractive()
  .setDepth(11)
  .setScale(SCREEN_WIDTH/3600)
  .on(
    "pointerdown",
    () => {
      if(this.hintSystem.timeoutId){
        clearTimeout(this.hintSystem.timeoutId);
              }
      this.stats.setVisible(true);
      this.otherGameButton3.setVisible(true);

      GameState.highScoreStatText.setVisible(true);
      GameState.shortestTimeText.setVisible(true);
      GameState.totalTimeText.setVisible(true);
      this.backButton.setVisible(true).setInteractive();
      GameState.hintButton.disableInteractive();  
      GameState.undoButton.disableInteractive();
      this.optionButton.disableInteractive();
      this.redealButton.disableInteractive();
      this.newDealButton.disableInteractive();
      this.deck.makeAllCardsInactive();
    },
    this
  )
;
this.add.text(SCREEN_WIDTH/11.5,SCREEN_HEIGHT / 1.112, "STATS", {
  color: "#000",
  fontSize: `${SCREEN_WIDTH/30}px Arial`,
});
     GameState.hintButton = this.add.image(SCREEN_WIDTH/1.27,SCREEN_HEIGHT / 1.155,"hint")//185
      .setInteractive()
      .setDepth(11)

      .on(
        "pointerdown",
        () => {
          this.hintSystem.provideHint()
        },
        this
      )
    ;
    GameState.hintButton.setScale(SCREEN_WIDTH/ 2512);

    this.add.text(SCREEN_WIDTH/1.33,SCREEN_HEIGHT / 1.112, "HINT", {
      color: "#000",
      fontSize: `${SCREEN_WIDTH/30}px Arial`,
    });

  
    GameState.undoButton = this.add.image(SCREEN_WIDTH/1.05,SCREEN_HEIGHT / 1.155,"undo")//185
    .setInteractive()
    .setDepth(11)
    .setScale(SCREEN_WIDTH/3375)
    .on(
      "pointerdown",
      () => {
        this.backStepSystem.performBackstep(this);
      },
      this
    )  ;

    this.add.text(SCREEN_WIDTH/1.1,SCREEN_HEIGHT / 1.112, "UNDO", {
      color: "#000",
      fontSize: `${SCREEN_WIDTH/30}px Arial`,
    });

  this.redealButton = this.add.image(SCREEN_WIDTH/1.91,SCREEN_HEIGHT / 1.155,"redeal")//185
  .setInteractive()
  .setDepth(11)
  .on(
    "pointerdown",
    () => {
      this.shuffleSound.play();
      this.deck.deal(this);
      this.myFlag = true;

      if(this.scaleTween){
        this.scaleTween.stop();    
        this.newDealButton.setScale(SCREEN_WIDTH/3600);
        this.redealButton.setScale(SCREEN_WIDTH/3600);
      
      }
      if(GameState.emitter){
        GameState.emitter.stop();
  
      }  
      this.backStepSystem.flushBackStepData();
      this.deck.makeAllCardsActive();
      this.finalScoreText.setVisible(false);
      this.highScoreText.setVisible(false);
      this.finalTimeText.setVisible(false);
      this.gameoverimage.setVisible(false);
      this.otherGameButton.setVisible(false);
      this.win_image.setVisible(false);
      this.otherGameButton2.setVisible(false);
      this.autoCompleteButton.setVisible(false);
      GameState.hintButton.setInteractive();  
      GameState.undoButton.setInteractive();
      this.optionButton.setInteractive();
      this.menuButton.setInteractive();
      this.score = 0;
      GameStorage.saveTotalGameplayTime(this.elapsedTime+ GameState.totalTime);
     
        if (this.timerEvent) {
          this.resetTimer();
          this.timerEvent.remove(false); // The 'false' parameter means the timer event won't execute the callback if it's currently running
        }
        this.timerEvent= this.time.addEvent({
          delay: 1000, // 1 second (in milliseconds)
          callback: this.updateElapsedTime,
          callbackScope: this,
          loop: true,
      });  
      if(this.gameoverimage.visible){
      this.gameoverimage.setVisible(false);
      this.otherGameButton.setVisible(false);
      }

    },
    this
  )  ;
this.redealButton.setScale(SCREEN_WIDTH/3600);

this.add.text(SCREEN_WIDTH/2.15,SCREEN_HEIGHT /  1.112, "REDEAL", {
  color: "#000",
  fontSize: `${SCREEN_WIDTH/30}px Arial`,
});

this.newDealButton = this.add.image(SCREEN_WIDTH/3,SCREEN_HEIGHT / 1.155,"newDeal")//185
.setInteractive()
.setDepth(11)

.on(
  "pointerdown",
  () => {
    if(this.scaleTween){
      this.scaleTween.stop();    
      this.newDealButton.setScale(SCREEN_WIDTH/3600);
      this.redealButton.setScale(SCREEN_WIDTH/3600);

    }    

    if(GameState.emitter){
      GameState.emitter.stop();

    }   
    setTimeout(() => {
      this.deck.shuffle(this.deck.cards);
      this.shuffleSound.play();
      this.deck.deal(this);
      this.myFlag = true;   
      this.autoCompleteButton.setVisible(false);
      this.backStepSystem.flushBackStepData();
  }, 2);

    this.gameoverimage.setVisible(false);
    this.otherGameButton.setVisible(false);
    this.finalScoreText.setVisible(false);
    this.finalTimeText.setVisible(false);
    this.deck.makeAllCardsActive();
    GameState.hintButton.setInteractive();  
    GameState.undoButton.setInteractive();
    this.menuButton.setInteractive();
    this.optionButton.setInteractive();
    this.highScoreText.setVisible(false);
    this.win_image.setVisible(false);
    this.otherGameButton2.setVisible(false);
    this.score = 0;
    HintSystem.hintCounter=0;
    GameStorage.saveTotalGameplayTime(this.elapsedTime+ GameState.totalTime);
    this.resetTimer();
    this.timerEvent.remove();
    this.timerEvent= this.time.addEvent({
      delay: 1000, // 1 second (in milliseconds)
      callback: this.updateElapsedTime,
      callbackScope: this,
      loop: true,
  });   

  // Applovin.showInterstitial(INTER_AD_UNIT_ID);
    this.showInterstitial()
  },
  this
)  ;
this.newDealButton.setScale(SCREEN_WIDTH/3600);

this.add.text(SCREEN_WIDTH/3.4,(SCREEN_HEIGHT) /  1.112, "NEW", {
  color: "#000",
  fontSize: `${SCREEN_WIDTH/30}px Arial`
});


this.autoCompleteButton = this.add.sprite(SCREEN_WIDTH/2+60,SCREEN_HEIGHT/1.5,"autocomplete")//185
.setInteractive()
.setDepth(49)
.setVisible(false)
.on(
  "pointerdown",
  () => {
    this.autoComplete.autoComplete();
  },
  this
)  ;
this.autoCompleteButton.setScale(SCREEN_WIDTH/1800);

  }

  public createText(): void {
    this.scoreText = this.add.text(SCREEN_WIDTH/ 1.6, SCREEN_HEIGHT/48, "", {
      color: "#FFF",
      fontSize: `${SCREEN_WIDTH/12.7}px Arial`,
    });

    GameState.hintText = this.add.text(SCREEN_WIDTH/2+50,SCREEN_HEIGHT/1.5, "", {
      color: "#FFF",
      font: `${SCREEN_WIDTH/15}px Arial`
    })
    .setVisible(false)
    .setOrigin(0.5)
    .setDepth(49);

    this.finalTimeText = this.add
    .text(SCREEN_WIDTH/2+50,SCREEN_HEIGHT/1.83, "0", {
      color: "#000",
      font: `${SCREEN_WIDTH/12}px Arial`
    })
    .setVisible(false)
    .setOrigin(0.5)
    .setDepth(51);

    this.finalScoreText = this.add
      .text(SCREEN_WIDTH/2+50,SCREEN_HEIGHT/2.91, "0", {
        color: "#000",
        font: `${SCREEN_WIDTH/12}px Arial`
      })
      .setVisible(false)
      .setOrigin(0.5)
      .setDepth(51);

      this.highScoreText = this.add
      .text(SCREEN_WIDTH/2+50,SCREEN_HEIGHT/2.21, "0", {
        color: "#000",
        font: `${SCREEN_WIDTH/12}px Arial`
      })
      .setVisible(false)
      .setOrigin(0.5)
      .setDepth(51);

      
      GameState.highScoreStatText = this.add
      .text(SCREEN_WIDTH/2+50,SCREEN_HEIGHT/3.21, GameState.highscore.toString(), {
        color: "#000",
        font: `${SCREEN_WIDTH/12}px Arial`
      })
      .setVisible(false)
      .setOrigin(0.5)
      .setDepth(51);

      GameState.shortestTimeText = this.add
      .text(SCREEN_WIDTH/2+50,SCREEN_HEIGHT/2.4, "0:00:00", {
        color: "#000",
        font: `${SCREEN_WIDTH/12}px Arial`
      })
      .setVisible(false)
      .setOrigin(0.5)
      .setDepth(51);

      GameState.totalTimeText = this.add
      .text(SCREEN_WIDTH/2+50,SCREEN_HEIGHT/1.9, "0:00:00", {
        color: "#000",
        font: `${SCREEN_WIDTH/12}px Arial`
      })
      .setVisible(false)
      .setOrigin(0.5)
      .setDepth(51);

   


  }

  public async showInterstitial(): Promise<void> {
    console.log("Dead Space: "+ GameState.interstitial_freq);
  
    if(GameState.interstitial_freq===0){
    await GameStorage.loadInterstitialValue();
    await AdMob.showInterstitial();

    }
    else{
      --GameState.interstitial_freq
    }
  }


  public drawCard(): void {
    // Get top card on current stack
    const topCard = this.deck.topCard(PileId.Stock);

    // Empty stack
    if (topCard) {
      this.hintSystem.counter++;
      this.dropSound.play();
      const topCardDisc = this.deck.topCard(PileId.Discard);
      if (topCardDisc) {
        topCardDisc.flipBack(this);
        topCard.reposition(PileId.Discard, topCardDisc.position + 1);
      } else {
        topCard.reposition(PileId.Discard, 0);
      }
      topCard.flip(this);
    } else {
      this.shuffleSound.play();
      let currentTop = this.deck.topCard(PileId.Discard);
      let position = 0;

      while (currentTop) {
        currentTop.reposition(PileId.Stock, position);
        currentTop.flipBack(this);
        position += 1;
        currentTop = this.deck.topCard(PileId.Discard);
      }

      if (position > 0) {
        this.score -= 100;
      }
    }


      const backstepData: BackstepData = {
        isTopCardFlipped: false,
        cards: this.dragChildren, // Map the card to its children
        sourcePile: PileId.Stock,
        score: this.score, // Save the current score
    };    
    console.log("Saved cards from Stock: ");

    for(let i=0; i<this.dragChildren.length; i++){
      console.log(this.dragChildren[i].value+" " +this.dragChildren[i].suit);

    }
      this.backStepSystem.pushBackstepData(backstepData);  
  }

  public flipScore(cardStack: PileId): void {
    if (TABLEAU_PILES.includes(cardStack)) {
      this.score += 5;
    }
  }

  public dropScore(zoneStack: PileId, cardStack: PileId): void {
     this.successSound.play();
    this.hintSystem.counter=0;
    // Waste to tableau
    if (cardStack === PileId.Discard && TABLEAU_PILES.includes(zoneStack)) {
      this.score += 5;
    }

    // Waste to foundation
    else if (
      cardStack === PileId.Discard &&
      FOUNDATION_PILES.includes(zoneStack)
    ) {
      this.score += 10;
    }

    // Tableau to foundation
    else if (
      TABLEAU_PILES.includes(cardStack) &&
      FOUNDATION_PILES.includes(zoneStack)
    ) {
      this.score += 10;
    }

    // Foundation to tableau
    else if (
      FOUNDATION_PILES.includes(cardStack) &&
      TABLEAU_PILES.includes(zoneStack)
    ) {
      this.score -= 15;
    }


  }
  public repositionCard(card: Card, pile:Pile){
    
  if(pile.pileId === card.currentPile){
    card.x = card.positionX;
    card.y = card.positionY;
  }
  for (let i = 0; i < this.dragChildren.length; i += 1) {
    console.log("Yetmez aga : "+ card.value +" "+ card.suit+" "+card.depth);
    this.dragChildren[i].reposition(card.pile, card.position + i);
    console.log("Yetmez aga2 : "+ card.value +" "+ card.suit+" "+card.depth);

  }
}

  public dragCardStart(card: Card): void {
    // Populate drag 
    console.log("Vili:  Dragstart ");
    this.dropSound.play();
    console.log("Card depth before dragstart: "+ card.value +" "+card.depth);
    card.currentPile = card.pile;
    card.positionX = card.x;
    card.positionY = card.y;
    this.dragChildren = [];
    if (TABLEAU_PILES.includes(card.pile)) {
      this.dragChildren = this.deck.cardChildren(card);
    } else {
      this.dragChildren.push(card);
    }

    // Set depths
    for (let i = 0; i < this.dragChildren.length; i += 1) {
      this.dragChildren[i].setDepth(100 + i);
    }
    console.log("Card depth after dragstart: "+ card.value +" "+card.depth);

  }

  public dragCard(_card: Card, dragX: number, dragY: number): void {
    // Set positions
    for (let i = 0; i < this.dragChildren.length; i += 1) {
      this.dragChildren[i].x = dragX;
      this.dragChildren[i].y = dragY + i * STACK_DRAG_OFFSET;
    }
  }

  // eslint-disable-next-line
  public dropCard(card: Card, dropZone: Pile, isCardHitted: boolean): void {
    // Potentially unsafe!
    const pileId = dropZone.name as PileId;
    console.log("Dropping: "+ pileId);

    
    // Get top card on current stack
    const topCard = this.deck.topCard(pileId);
    const oldCardPile = card.pile;
    const oldScore = this.score;

    if(isCardHitted){

      this.dragChildren = [];
      if (TABLEAU_PILES.includes(card.pile)) {
        this.dragChildren = this.deck.cardChildren(card);
      } else {
        this.dragChildren.push(card);
      }
  }

    // Empty stack
    if (!topCard) {
      if (
        (card.value === 13 && TABLEAU_PILES.includes(pileId)) ||
        (card.value === 1 && FOUNDATION_PILES.includes(pileId))
        
      ) {
        console.log("off ya offf 2");
        this.dropScore(pileId, card.pile);

        console.log("Topcard before: "+ card.value +" "+card.depth);

        card.reposition(pileId, 0);
        console.log("Topcard after: "+ card.value +" "+card.depth);

      }
      
    }


    // Tableau
    else if (TABLEAU_PILES.includes(pileId)) {
      if (
        (SUIT_COLOR[card.suit] !== SUIT_COLOR[topCard.suit] &&
        card.value === topCard.value - 1) 
        
      ) {
        this.successSound.play();
        console.log("Tableau baby!");
        console.log("Tableaue before: "+ card.value +" "+card.depth);

        this.dropScore(pileId, card.pile);
        card.reposition(pileId, topCard.position + 1);
        console.log("Tableaue after: "+ card.value +" "+card.depth);

      }
   
    }

    // Foundation
    else if (FOUNDATION_PILES.includes(pileId)) {
      if ((card.suit === topCard.suit && card.value === topCard.value + 1 && (this.deck.cardChildren(card).length===1) ) ) {
        this.dropScore(pileId, card.pile);
        console.log("Foundation baby!");
        console.log("Foundation before: "+ card.value +" "+card.depth);

        card.reposition(pileId, topCard.position + 1);
        console.log("Foundation after: "+ card.value +" "+card.depth);

      }
   
    }
 

    // Drop all other cards on top

    for (let i = 1; i < this.dragChildren.length; i += 1) {
      console.log("Yetmez aga : "+ card.value +" "+ card.suit+" "+card.depth);
      this.dragChildren[i].reposition(card.pile, card.position + i);
      console.log("Yetmez aga2 : "+ card.value +" "+ card.suit+" "+card.depth);

    }

    // Flip top card on past stack
    const topCardNew = this.deck.topCard(oldCardPile);
    const isItFlipped = topCardNew? topCardNew?.flipped: false; 
    if (topCardNew && topCardNew !== card && !isItFlipped) {
      topCardNew.flip(this);
      this.flipScore(topCardNew.pile);
    }

   


    if(oldCardPile!== card.pile ){
      console.log("i was called!");

      const backstepData: BackstepData = {
        isTopCardFlipped:isItFlipped,
        cards: this.dragChildren, // Map the card to its children
        sourcePile: oldCardPile,
        score: oldScore, // Save the current score
    };
    console.log("Saved cards from Tableau/Foundation: "+ oldCardPile);
    console.log("Is top card flipped: "+ isItFlipped);


    for(let i=0; i<this.dragChildren.length; i++)
    {
      console.log(this.dragChildren[i].value+" "+this.dragChildren[i].suit);
    }      
      this.backStepSystem.pushBackstepData(backstepData);

    }
  }

  public returnCard(isItFlipped: boolean,cards: Card[], dropZone: Pile): void {
    // Potentially unsafe!
    const pileId = dropZone.name as PileId;
    // Get top card on current stack
    const topCard = this.deck.topCard(pileId);
    console.log("The top card in the returned zone: "+ topCard?.value + topCard?.suit);
    if(dropZone.pileId!==PileId.Stock){
      if(topCard){
        console.log("The top card is flipped? "+ topCard.flipped);
        if(!isItFlipped){
          topCard.flipBack(this);
          console.log("The top card is flipped? "+ topCard.flipped);
        }
        
        for(let i=0; i< cards.length; i++){
        cards[i].reposition(pileId, topCard.position + i+1);
        console.log("After reposition: "+ cards[i].value+" "+ cards[i].suit+" position: "+ cards[i].position);
      }
      }
      else{
        cards[0].reposition(pileId, 0);
        console.log("After reposition of topless pile first card: "+ cards[0].value+" "+ cards[0].suit + " position: "+cards[0].position);
        for(let i=1; i< cards.length; i+=1){
          cards[i].reposition(pileId, cards[0].position + i);
          console.log("After reposition of topless pile : "+ cards[i].value+" "+ cards[i].suit+" position: "+ cards[i].position);
        }
      }
    }
    else {
      const topCardDisc = this.deck.topCard(PileId.Discard);
      const topCardStock = this.deck.topCard(PileId.Stock);
      if (topCardDisc) {
        topCardDisc.flipBack(this);
        if(topCardStock){
          topCardDisc.reposition(pileId, topCardStock.position + 1);
          this.deck.topCard(PileId.Discard)?.flip(this);
        }
        else{
          topCardDisc.reposition(pileId, 0);
          this.deck.topCard(PileId.Discard)?.flip(this);
        }
      }
    }
  }

  public getPileById(pileId: PileId): Pile | undefined {
    const pileName = pileId.toString();
    const pile = this.scene.scene.children.getByName(pileName) as Pile;
    return pile;
}


public getAllPiles(): Pile[] {
  const allPiles: Pile[] = [];
  for(let i=0; i<TOTAL_PILES.length; i++ ){
    const pileName = i.toString();
    let pile = this.scene.scene.children.getByName(pileName) as Pile;
    allPiles.push(pile);
  }

  return allPiles;
}
  
private stopEmitter(): void {
  if (GameState.emitter) {
      GameState.emitter.stop();
  }
}

private winAnimation(): void {

  
       GameState.emitter = this.add.particles(0,0, 'particles', {
                frame: ['Match3_Icon_30', 'Match3_Icon_29', 'Match3_Icon_31', 'Match3_Icon_32'],
                lifespan: 4000,
                speed: { min: 500, max: 650 },
                scale: { start: 0.9, end: 0 },
                rotate: { start: 0, end: 360 },
                gravityY: 50,
                //emitting: false
            });
  
    this.buttonScale([this.newDealButton,this.redealButton]);

  if (GameState.emitter) {
    GameState.emitter.setPosition(this.win_image.x, this.win_image.y * 0.5);
    GameState.emitter.setDepth(35);

    // Stop the emitter after 2 seconds
    setTimeout(() => {
      this.stopEmitter();
    }, 2000);
  }
}



  
  public update(): void {
  
    this.timerText.setText(this.formatTime(this.elapsedTime));
    // Ensure score is within range
    if (this.score < 0) {
      this.score = 0;
    }

    if(this.deck.countCards( PileId.Stock)===0 && this.deck.countCards(PileId.Discard) ===0 && this.deck.areAllCardsFaceUp() && !this.win_image.visible ){
      this.autoCompleteButton.setVisible(true);
      if(this.hintSystem.timeoutId){
        clearTimeout(this.hintSystem.timeoutId);
      }
    }

    // Win
    const cardsOnFoundation = FOUNDATION_PILES.reduce(
      (acc, pile) => acc + this.deck.countCards(pile),
      0
    );

    
    if (cardsOnFoundation === 52 && this.myFlag) {
      console.log("Buradayim!!!");
      this.myFlag = false;
      this.finalScoreText.setText(`${this.score}`) ;
      this.finalTimeText.setText(`${ this.formatTime(this.elapsedTime)}`) ;
      this.highScoreText.setText(`${GameState.highscore > this.score ? GameState.highscore : this.score}`) ;
      GameState.highScoreStatText.setText(`${GameState.highscore > this.score ? GameState.highscore : this.score}`) ;
      this.finalScoreText.setVisible(true);
      this.finalTimeText.setVisible(true);
      this.highScoreText.setVisible(true);
      this.win_image.setVisible(true);
      this.otherGameButton2.setVisible(true);
      this.autoCompleteButton.setVisible(false);
      this.winSound.play();
      this.winAnimation();
      GameState.hintButton.disableInteractive();  
      GameState.undoButton.disableInteractive();
      this.optionButton.disableInteractive();
      this.menuButton.disableInteractive();
      //this.deck.makeAllCardsInactive();
      
      if(this.hintSystem.timeoutId){
        clearTimeout(this.hintSystem.timeoutId);
        this.hintSystem.timeoutId = null;
      }
      document.removeEventListener('touchstart', this.hintSystem.handleUserActivity);

      // Assuming this.timerEvent is your active timer event
      if(this.score> GameState.highscore){

        console.log("Naber???");
        GameState.highScoreStatText.text = GameState.highscore.toString();
        GameStorage.saveHighscore(this.score);
      }
      console.log("this.elapsedTime: "+ this.elapsedTime);
      console.log("GameState.shortestTime: "+ GameState.shortestTime);

      if( this.elapsedTime < GameState.shortestTime){
        console.log("Inside the if of shortest time");

        GameState.shortestTimeText.text = this.formatTime(GameState.shortestTime);
        GameStorage.saveShortestGameTime(this.elapsedTime);
        
      }

    if (this.timerEvent) {
      this.timerEvent.remove(false); // The 'false' parameter means the timer event won't execute the callback if it's currently running
    }
    }

    // Display lives
    this.scoreText.setText(`Score: ${this.score}`);
  }

  

}
