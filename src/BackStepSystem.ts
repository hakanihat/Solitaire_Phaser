import GameState from "./GameState";
import Card from "./Card";
import { PileId } from "./constants/table";
//import { GameObjects } from "phaser";

export interface BackstepData {
  isTopCardFlipped: boolean;
  cards:  Card[]; // Array of cards moved
  sourcePile: PileId; // Pile from which the cards were moved
  score: number; // Score at this step
}

export default class BackstepSystem {
  private backstepDataStack: BackstepData[] = [];

  constructor() {
    // Initialize your Backstep system
  }

  public flushBackStepData(){
    this.backstepDataStack.splice(0, this.backstepDataStack.length);
  }

  // Method to push backstep data to the stack
  public pushBackstepData(data: BackstepData): void {
    // Create a deep copy of the backstep data to avoid references
    this.backstepDataStack.push(data);
  }

  // Method to perform a backstep
  public performBackstep(gameState: GameState): void {
    // Check if there are previous steps to restore
    if (this.backstepDataStack.length > 0) {
      console.log("Vili:  backStep length: "+ this.backstepDataStack.length)
      // Get the most recent step's data
      const previousStepData = this.backstepDataStack.pop();
      console.log("meme: " + previousStepData?.sourcePile);
  
      for(let i=0; i<previousStepData!.cards.length; i++){
        console.log("meme: " + previousStepData?.cards[i].value+" "+ previousStepData?.cards[i].suit);

      }
        gameState.returnCard(previousStepData!.isTopCardFlipped,previousStepData!.cards, gameState.getPileById(previousStepData!.sourcePile)!);
        gameState.score = previousStepData!.score;
  
      // Update your game interface to reflect the changes
    }
  }
  
  
  
  
}
