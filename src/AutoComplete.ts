import Card from "./Card";
import { FOUNDATION_PILES, PileId, TABLEAU_PILES } from "./constants/table";
import GameState from "./GameState";
import { Pile } from "./Pile";

export class AutoComplete {
    private static instance: AutoComplete | null = null;

  constructor(private gameState: GameState) {}
  public static getInstance(): AutoComplete  {
    if (!AutoComplete.instance) {
        AutoComplete.instance = new AutoComplete(GameState.getInstance());
    }
    return AutoComplete.instance;
  }

  public autoComplete(): void {
    let cardsOnFoundation;
    
    while (cardsOnFoundation !== 52 ) {
      // Check if there are any moves to the foundation piles
      for (const pileId of FOUNDATION_PILES) {
        this.autoCompleteToFoundation(pileId);
        console.log("Gunaydin: inside the loop");
      }
    
      console.log("Gunaydin: out of the loop");
      console.log("CARD ON FOUNDATION: " + cardsOnFoundation);
    
      cardsOnFoundation = FOUNDATION_PILES.reduce(
        (acc, pile) => acc + this.gameState.deck.countCards(pile),
        0
      );

    }
    
    if (cardsOnFoundation !== 52) {
      console.log("Time limit reached. Exiting loop.");
    }
    
  }

  private autoCompleteToFoundation(pileId: PileId): void {
    const foundationPile = this.gameState.getPileById(pileId);
  
    if (foundationPile !== undefined) {
      console.log("Foundation Pile here " + foundationPile.name);
  
      // Loop through tableau piles
      for (const tableauPile of TABLEAU_PILES) {
        // Check if the tableau pile has cards
        console.log("tab pile length: " + tableauPile.length);
  
        if (tableauPile.length > 0) {
          const topCard = this.gameState.deck.topCard(tableauPile);
  
          if (topCard !== null) {
            // Check if the top card can be moved to the foundation pile
            if (this.canAcceptCard(foundationPile, topCard)) {
              // Move the card to the foundation pile
              console.log("Card dropped: " + topCard.value + " " + topCard.suit + " Foundation: " + foundationPile.name);
              this.gameState.dropCard(topCard, foundationPile,true);
  
              // Add a 2-second delay before updating game state and graphics
            }
          } else {
            console.log("Where is the topCard???");
            continue;
          }
        }
      }
    } else {
      
      console.log("ZORTLADINIZ");
    }
  }
  




  private canAcceptCard(foundationPile: Pile, card: Card|null): boolean {
    // This logic determines if a card can be accepted on a foundation pile.
    const cards = this.gameState.deck.faceUpCards(foundationPile.pileId);
    if(card!==null){

   
    if (cards.length === 0) {
      // If the pile is empty, any card can be placed on it (e.g., starting with an Ace).
      return card.value === 1; // Check if it's an Ace (or any other criteria).
    } else {
      // If the pile is not empty, check if the incoming card can be placed based on game rules.
      const topCard = this.gameState.deck.topCard(foundationPile.pileId); // Get the top card in the pile.
      // Check if the suits match (e.g., hearts on hearts, clubs on clubs, etc.).
      const suitsMatch = card.suit === topCard!.suit;

      // Check if the incoming card's value is one greater than the top card's value.
      const isOneHigher = card.value === topCard!.value + 1;

      return suitsMatch && isOneHigher;
    }
  }
  else{
    console.log("WHYY autocomplete: "+ card!.value) 
  return false;
  }
}


}
