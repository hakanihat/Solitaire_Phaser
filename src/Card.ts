import * as Phaser from "phaser";
import {
  CARD_BACK_INDEX,
  STACK_OFFSET,
  SPRITE_CARD_WIDTH,
  SUIT_IMAGE_INDEX,
  CARD_DIMENSIONS,
  type Suit,
} from "./constants/deck";
import {
  FOUNDATION_PILES,
  PileId,
  //getCurrentPositions,
  TABLEAU_PILES,
  getCurrentPositions,
} from "./constants/table";
import GameState from "./GameState";
import HintSystem from "./HintSystem";
//import GameState from "./GameState";

export default class Card extends Phaser.GameObjects.Sprite {
  public suit: Suit;

  public value: number;

  public pile = PileId.None;

  public position: number = -1;

  public flipped: boolean = false;

  private animationFlag: boolean = true;

  public positionX!: number;
  public positionY!: number;
  public currentPile = PileId.None;
  private positions: Record<PileId, Phaser.Math.Vector2>;
  static hintSys: HintSystem;



  public constructor(scene: Phaser.Scene, suit: Suit, value: number) {
    // Create sprite
    super(scene, 0, 0, "img_cards", CARD_BACK_INDEX);
    scene.add.existing(this);
    console.log("Card position handler");
    this.positions = getCurrentPositions(GameState.isLeftHanded);

    // Suit and Value
    this.suit = suit;
    this.value = value;
   
    // Width and Height
    this.setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);

    // Click event
    this.setInteractive();
    this.addLeftHandedChangeListener();

  }


  public static giveMeHint(hintS : HintSystem){
    this.hintSys = hintS;
  }
  public reposition(pile: PileId, position: number): void {
    this.pile = pile;
    this.position = position;

    this.setDepth(this.position + 10);

    if (this.pile === PileId.Stock || this.pile === PileId.Discard) {
      this.setPosition(
        this.positions[this.pile].x + position,
        this.positions[this.pile].y
      );
    } else if (TABLEAU_PILES.includes(this.pile)) {
      this.setPosition(
        this.positions[this.pile].x,
        this.positions[this.pile].y + position * STACK_OFFSET
      );
    } else if (FOUNDATION_PILES.includes(this.pile)) {
      this.setPosition(
        this.positions[this.pile].x,
        this.positions[this.pile].y
      );
    }

    this.positionX = this.x;
    this.positionY = this.y;
  }

  private addLeftHandedChangeListener(): void {
    // Listen for changes in GameState.isLeftHanded
    this.scene.events.on('updateLeftHanded', (isLeftHanded: boolean) => {
      // Update positions and reposition the pile when isLeftHanded changes
      this.positions = getCurrentPositions(isLeftHanded);
      this.reposition(this.pile,this.position);
    });
  }

  public flip(scene: Phaser.Scene): void {
    this.setTexture("img_cards", this.getSpriteIndex(this.suit, this.value));
    scene.input.setDraggable(this);
    this.flipped = true;
    if(GameState.isHitMoveEnabled){
      this.on('pointerup', () => {
        Card.hintSys.moveCardOnClick(this);
        console.log("Kinda amazing!");
      });
    }
  
  }

  public flipBack(scene: Phaser.Scene): void {
    this.setTexture("img_cards", CARD_BACK_INDEX);
    scene.input.setDraggable(this, false);
    this.flipped = false;
    if(GameState.isHitMoveEnabled){
    this.off('pointerup');
  }
  }

  public getSpriteIndex(suit: Suit, value: number): number {
    return SUIT_IMAGE_INDEX[suit] * SPRITE_CARD_WIDTH + value - 1;
  }
  public scaleUp(): void {
    // Delay before listening to pointerdown event (e.g., 1000 milliseconds or 1 second)
    const delayMilliseconds = 10;
  
    // Start the scaling animation after the delay
    setTimeout(() => {
      const scaleTween = this.scene.tweens.add({
        targets: this,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 500,
        ease: 'Linear',
        repeat: -1,
        yoyo: true,
      });
  
      // Handle pointerdown event to stop and reset the animation
      this.scene.input.on('pointerdown', () => {
        // Stop the animation
        scaleTween.stop(/*0*/);
  
        // Reset the scale
       this.setScale(0.6,0.69);
  
        // Remove the pointerdown event listener
        this.scene.input.off('pointerdown');
      });
    }, delayMilliseconds);
  }

  public moveToPile(pileX: number, pileY: number): void {
    // Remove any existing click    listeners
    if(this.animationFlag){
      this.animationFlag = false;
      //this.scene.input.off('pointerdown');
      const xOld = this.positionX;
      const yOld = this.positionY;
      const cardDepth = this.depth;
      this.depth = 50;
      // GameState.undoButton.disableInteractive();

      // Delay before   starting the animation
      setTimeout(() => {
        const moveTween = this.scene.tweens.add({
          targets: this,
          x: pileX,
          y: pileY,
          duration: 1000,
          ease: 'Linear',
          repeat: -1,
          hold: 1000,
        });
    
        // Add a click listener to stop the   tween when the screen is touched
        const stopTween = () => {
          moveTween.stop();
          this.animationFlag = true;
          this.x =xOld;
          this.y = yOld;
          this.depth = cardDepth;
          console.log(`Hello: ${this.x} - ${this.y} : ${this.value} - ${this.suit}`)
          // GameState.undoButton.setInteractive();
          this.scene.input.off('pointerdown', stopTween);
        };
    
        this.scene.input.on('pointerdown', stopTween);
      }, 0.1);
    }
   
  }
  

  public drawCardBorder(): void {
    const borderWidth = 3; // Customize the border width as needed
    const borderColor = 0xff0000; // Specify the color of the border in hexadecimal

    const graphics = this.scene.add.graphics();
    graphics.lineStyle(borderWidth, borderColor);
    graphics.strokeRect(
      this.x - this.displayWidth / 2,
      this.y - this.displayHeight / 2,
      this.displayWidth,
      this.displayHeight
    );
  }
  
  
  
}
