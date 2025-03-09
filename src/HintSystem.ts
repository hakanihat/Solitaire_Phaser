import Card from "./Card";
import { PileId, TABLEAU_PILES, FOUNDATION_PILES,  } from "./constants/table";
import { STACK_OFFSET, Suit } from "./constants/deck";
import { Pile } from "./Pile";
import GameState from "./GameState";

class HintSystem {
  private static instance: HintSystem | null = null;
  public counter: number;
  //private positions: Record<PileId, Phaser.Math.Vector2>;

  public static hintCounter: number = 0;
  public timeoutId: ReturnType<typeof setTimeout> | null = null;

  public firstAutoHint: boolean = true;
  private moveInfo!: { card: Card | undefined; foundationPile: Pile | undefined } ;
  private moveInfo2!: { card: Card | undefined; destinationPile: Pile | undefined } ;

  constructor(private gameState: GameState) { this.counter = 0;
    document.addEventListener('touchstart', this.handleUserActivity);
    //this.positions = getCurrentPositions(GameState.isLeftHanded);
  }


  public static getInstance(): HintSystem {
    if (!HintSystem.instance) {
      HintSystem.instance = new HintSystem(GameState.getInstance());
      
    }
    return HintSystem.instance;
  }

  public handleUserActivity = (): void => {
    if(this.timeoutId || this.firstAutoHint){
      this.firstAutoHint = false;
   
   
       GameState.hintText.setVisible(false);
       GameState.hintButton.setInteractive();
  
      // Clear any existing timeout
      if (this.timeoutId ) {
        clearTimeout(this.timeoutId);
      }
    
      // Set a new timeout for 4 seconds after which the user is considered inactive
      this.timeoutId = setTimeout(() => {

        if (!this.gameState.win_image.visible && !this.gameState.gameoverimage.visible && !this.gameState.stats.visible)  {
          this.scheduleHintAnimation();
        }    
          else{
            GameState.hintText.setVisible(false);
            GameState.hintButton.setInteractive();
          }

      }, 4000);
    
    }
  };
  


  public provideHint(): void {
    // Increment the hint counter
    

    // Check if the hint counter is within the limit
    
      this.moveInfo = this.canMoveCardToFoundation();
      if (this.moveInfo.card !== undefined && this.moveInfo.foundationPile !== undefined) {
        const theCard = this.gameState.deck.topCard(this.moveInfo.foundationPile.pileId);
        if(theCard){
          this.moveInfo.card.moveToPile(theCard?.x,theCard?.y);
          this.moveInfo.foundationPile.drawFilledGoldenRectangleWithFlashingEffect(false);     
        }
        else{
          this.moveInfo.card.moveToPile(this.moveInfo.foundationPile.x,this.moveInfo.foundationPile.y);
          this.moveInfo.foundationPile.drawFilledGoldenRectangleWithFlashingEffect(false);    
        }
        
        return;
      } 
    
      this.moveInfo2 = this.canMoveCardWithinTableau();
      if (this.moveInfo2.card !== undefined && this.moveInfo2.destinationPile !== undefined) {
        const theCard = this.gameState.deck.topCard(this.moveInfo2.destinationPile.pileId);

        if(theCard){
          this.moveInfo2.card.moveToPile(theCard?.x,theCard?.y+STACK_OFFSET);
          this.moveInfo2.destinationPile.drawFilledGoldenRectangleWithFlashingEffect(true);     
        }
        else{
          this.moveInfo2.card.moveToPile(this.moveInfo2.destinationPile.x,this.moveInfo2.destinationPile.y - this.moveInfo2.destinationPile.height / 2+125);//125 magic number
          this.moveInfo2.destinationPile.drawFilledGoldenRectangleWithFlashingEffect(true);  
        }
        return;
      }

      this.informNoHintsAvailable();
    
  }


  public scheduleHintAnimation(): void {
    HintSystem.hintCounter++;
    //GameState.hintButton.setVisible(false);
    if(HintSystem.hintCounter <=3 ){
      GameState.hintButton.disableInteractive();
      this.provideHint();
      if(this.moveInfo.card !== undefined && this.moveInfo.foundationPile !== undefined){
        GameState.hintText.setText(`Move ${this.moveInfo.card.suit} ${this.moveInfo.card.value} to ${this.moveInfo.foundationPile.name}! `);
        GameState.hintText.setVisible(true);

      }
      else if(this.moveInfo2.card !== undefined && this.moveInfo2.destinationPile !== undefined){
        GameState.hintText.setText(`Move ${this.moveInfo2.card.suit} ${this.moveInfo2.card.value} to ${this.moveInfo2.destinationPile.name}! `);
        GameState.hintText.setVisible(true);
      }
      else{
        GameState.hintText.setText( "Draw card from stockpile!");
        GameState.hintText.setVisible(true);
      }
      

    }
  
  }

// Modify the canMoveCardToFoundation() method to return the card and foundation pile instance.
private canMoveCardToFoundation(clickedCard?: Card): { card: Card | undefined; foundationPile: Pile | undefined } {
  const allPilesToCheck = [PileId.Discard, ...TABLEAU_PILES];

  for (const tableauPile of allPilesToCheck) {
    const topTableauCard = clickedCard || this.gameState.deck.topCard(tableauPile);

    // If the tableau pile has a top card, check if it can be moved to the foundation piles
    if (topTableauCard) {
      for (const foundationPile of FOUNDATION_PILES) {
        const topFoundationCard = this.gameState.deck.topCard(foundationPile);

        if (
          (!topFoundationCard && topTableauCard.value === 1) || // If the foundation pile is empty and the top tableau card is an Ace
          (topFoundationCard && topTableauCard.suit === topFoundationCard.suit && topTableauCard.value === topFoundationCard.value + 1)
        ) {
          // Retrieve the Pile instance corresponding to the foundationPile ID
          const foundationPileInstance = this.gameState.getPileById(foundationPile);
          this.counter = 0;
          // Return the card and foundationPile instances if the move is possible
          return { card: topTableauCard, foundationPile: foundationPileInstance };
        }
      }
    }
  }

  // Return undefined if no move is possible
  return { card: undefined, foundationPile: undefined };
}








  
private canMoveCardWithinTableau(clickedCard?: Card): { card: Card | undefined, destinationPile: Pile | undefined } {
  const allPilesToCheck = [PileId.Discard, ...TABLEAU_PILES];
  let bestMove: { card: Card | undefined, destinationPile: Pile | undefined } = { card: undefined, destinationPile: undefined };
  let bestPriority = 0; // Initialize the best priority with the lowest value

  for (const sourcePile of allPilesToCheck) {
    const sourcePileCards = clickedCard ? [clickedCard] : this.gameState.deck.faceUpCards(sourcePile);

    if (sourcePileCards.length > 0) {
      for (const destinationPile of allPilesToCheck) {
        if (sourcePile !== destinationPile) {
          const destinationTopCard = this.gameState.deck.topCard(destinationPile);

          for (const sourceCard of sourcePileCards) {
            if (this.canMoveCardToDestination(sourceCard, destinationTopCard) && destinationPile !== PileId.Discard) {
              // Calculate the move's priority
              const priority = this.moveHasBenefits(sourceCard, sourcePile);
              // Check if the move has a higher priority than the current best move
              if (priority >= bestPriority) {
                // Update the best move and best priority
                //if(sourcePile === PileId.Discard){
                  this.counter=0;
                //}
                bestPriority = priority;
                const destinationPileRef = this.gameState.getPileById(destinationPile);
                bestMove = { card: sourceCard, destinationPile: destinationPileRef };
              }
            }
          }
        }
      }
    }
  }

  return bestMove;
}


private moveHasBenefits(sourceCard: Card, sourcePile: PileId): number {
  // Check if the card is the last card in the pile
  const isLastCard = this.isLastCardInPile(sourceCard, sourcePile);
  // Check if the card has flipped cards after it
  const hasFlippedCardBefore= this.hasFlippedCardBefore(sourceCard, sourcePile);

  return ((isLastCard + hasFlippedCardBefore) === 0) 
  && (!(this.gameState.deck.topCard(PileId.Discard)===sourceCard)) 
  ? -1 :isLastCard + hasFlippedCardBefore;
}


private isLastCardInPile(sourceCard: Card, sourcePile: PileId): number {
  const pileCards = this.gameState.deck.cards.filter((card) => card.pile === sourcePile);


  if (pileCards.length === 0) {
    // The pile is empty, and the card is not in the pile
    return 0;
  }

  if (sourceCard.position===0 && sourceCard.value !== 13) {
    // The card is the most bottom card in the pile and is not a King
    return 1;
  }

  return 0;
}



private hasFlippedCardBefore(sourceCard: Card, sourcePile: PileId): number {
  const pileCards = this.gameState.deck.cards.filter((card) => card.pile === sourcePile);

  const sourceCardIndex = pileCards.findIndex((card) => card === sourceCard);

  if (sourceCardIndex > 0) {
    const previousCard = pileCards[sourceCardIndex - 1];
    if (!previousCard.flipped) {
      // The card before the sourceCard is face-down
      return 2;
    }
  }

  return 0;
}

public moveCardOnClick(clickedCard: Card): void {
  console.log("Vili:  From the tap event");

  if(GameState.isHitMoveEnabled){
    const foundationMoveInfo = this.canMoveCardToFoundation(clickedCard);
    const tableauMoveInfo = this.canMoveCardWithinTableau(clickedCard);
  
    if (foundationMoveInfo.card === clickedCard && foundationMoveInfo.foundationPile !== undefined) {
      this.gameState.dropCard(clickedCard, foundationMoveInfo.foundationPile,true);
  
    } else if (tableauMoveInfo.card === clickedCard && tableauMoveInfo.destinationPile !== undefined) {
      this.gameState.dropCard(clickedCard, tableauMoveInfo.destinationPile,true);
  
    } else {
      console.log("Cannot move the clicked card to an appropriate place.");
    }
  }

}





private canMoveCardToDestination(sourceCard: Card, destinationTopCard: Card | null): boolean {
  if (destinationTopCard === null) {
    return sourceCard.value === 13; // Destination pile is empty, and source card is a King
  }

  return (
    sourceCard.value === destinationTopCard.value - 1 &&
    this.areDifferentColors(sourceCard, destinationTopCard)
  );
}


  private areDifferentColors(card1: Card, card2: Card): boolean {
    // Check if the suits of the cards are different
    return (
      (card1.suit === Suit.Hearts || card1.suit === Suit.Diamonds) &&
      (card2.suit === Suit.Clubs || card2.suit === Suit.Spades)
    ) || (
      (card1.suit === Suit.Clubs || card1.suit === Suit.Spades) &&
      (card2.suit === Suit.Hearts || card2.suit === Suit.Diamonds)
    );
  }
  
  



  
  private informNoHintsAvailable(): void {
    const stockCards = this.gameState.deck.cards.filter((card) => card.pile === PileId.Stock);
    const discardCards = this.gameState.deck.cards.filter((card) => card.pile === PileId.Discard);
    if (stockCards.length + discardCards.length < this.counter || stockCards.length + discardCards.length ===0) {
      this.gameState.gameOver();
      
    }
    else{
    const stock = this.gameState.getPileById(PileId.Stock);
    if(stock!== undefined){
      stock.drawFilledGoldenRectangleWithFlashingEffect(false);
    }
  }
  }
}

export default HintSystem;
