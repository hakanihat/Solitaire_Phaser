import GameState from "./GameState";
import { CARD_DIMENSIONS, STACK_OFFSET } from "./constants/deck";
import { PileId,  getCurrentPositions, TABLEAU_PILES } from "./constants/table";

export class Pile extends Phaser.GameObjects.Zone {
  public pileId: PileId;
  private animationFlag: boolean = true;
  private positions: Record<PileId, Phaser.Math.Vector2>;
  private position: Phaser.Math.Vector2;
  private addHeight: number;
  private addWidth: number;
  private graphicsPile:Phaser.GameObjects.Graphics;
  private zone: Phaser.GameObjects.Zone;

  public constructor(scene: Phaser.Scene, pileId: PileId) {
    super(scene, 0, 0, 0, 0);

    this.pileId = pileId;
    console.log("Pile position handler");
    this.positions = getCurrentPositions(GameState.isLeftHanded);
    // Additional height for tableau
    this.addHeight = TABLEAU_PILES.includes(this.pileId)
      ? STACK_OFFSET * 20
      : 0;
    this.addWidth = this.pileId === PileId.Stock ? 20 : 0;
    // Get position
    this.position = this.positions[this.pileId];

    // Make zone
    this.setPosition(this.position.x + this.addWidth / 2, this.position.y + this.addHeight / 2);
    this.setSize(
      CARD_DIMENSIONS.width + this.addWidth,
      CARD_DIMENSIONS.height + this.addHeight
    );

    this.zone = this.setRectangleDropZone(this.width, this.height);
    this.zone.setName(this.pileId);

    // Drop zone visual
    if (this.pileId !== PileId.None) {
     this.graphicsPile = this.scene.add
        .graphics()
        .lineStyle(2, 0xffffff)
        .strokeRect(
          this.x - this.width / 2,
          this.y - this.height / 2,
          CARD_DIMENSIONS.width,
          CARD_DIMENSIONS.height
        );
    }else{
      this.graphicsPile =this.scene.add.graphics() ;
      this.graphicsPile.destroy();
    }
    this.addLeftHandedChangeListener();
    
  }

  private addLeftHandedChangeListener(): void {
    // Listen for changes in GameState.isLeftHanded
    this.scene.events.on('updateLeftHanded', (isLeftHanded: boolean) => {
      // Update positions and reposition the pile when isLeftHanded changes
      this.positions = getCurrentPositions(isLeftHanded);
      this.repositionPile();
    });
  }

  public repositionPile() {
    // Remove existing graphics and drop zone
    this.removeExistingGraphics();
    // Additional height for tableau
    const addHeight = TABLEAU_PILES.includes(this.pileId) ? STACK_OFFSET * 20 : 0;
    const addWidth = this.pileId === PileId.Stock ? 20 : 0;
  
    // Get position
    const position = this.positions[this.pileId];
  
    // Make zone
    this.setPosition(position.x + addWidth / 2, position.y + addHeight / 2);
    this.setSize(
      CARD_DIMENSIONS.width + addWidth,
      CARD_DIMENSIONS.height + addHeight
    );
  
    this.zone = this.setRectangleDropZone(this.width, this.height);
    this.zone.setName(this.pileId);
  
    // Drop zone visual
    if (this.pileId !== PileId.None) {
      this.graphicsPile =this.scene.add
        .graphics()
        .lineStyle(2, 0xffffff)
        .strokeRect(
          this.x - this.width / 2,
          this.y - this.height / 2,
          CARD_DIMENSIONS.width,
          CARD_DIMENSIONS.height
        );
    }
  }
  
  private removeExistingGraphics() {
    // Remove existing graphics (if any)
    if (this.graphicsPile) {
      console.log("Tepkikolik");
      this.graphicsPile.destroy();
    }
  }
  
  
  public drawFilledGoldenRectangleWithFlashingEffect(flag: boolean): void {
    if(this.animationFlag){
    this.animationFlag = false;
    const goldenColor = 0xffd700; // Golden color in hexadecimal
    const graphics = this.scene.add.graphics();
    const delayMilliseconds =  0.00000000000000000001;
    // Create the filled golden rectangle
    graphics.fillStyle(goldenColor, 1); // 1 is the alpha (fully opaque)
    if(flag){
      graphics.fillRect(
        this.x - this.width / 2,
        this.y - this.height / 2,
        this.width,
        this.height/2
      );
    }else{
      graphics.fillRect(
        this.x - this.width / 2,
        this.y - this.height / 2,
        this.width,
        this.height
      );
    }

    graphics.setDepth(49);
    // Create a flashing effect using a Phaser tween
    setTimeout(()=>{
    const tweenAnim = this.scene.tweens.add({
      targets: graphics,
      alpha: 0, // Make the rectangle transparent
      duration: 500, // Duration of each half of the blink (adjust as needed)
      yoyo: true, // Repeat the animation in reverse to create the blinking effect
      repeat: -1, // Repeat infinitely
    });

    this.scene.input.on('pointerdown', () => {
      // Stop the animation
      tweenAnim.stop();
      this.animationFlag = true;

      graphics.destroy();
      //this.scene.input.off('pointerdown');
    });}

    ,delayMilliseconds)
  }
  
  // Add this method to your Pile class

}


}






