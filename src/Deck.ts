import Card from "./Card";
//import HintSystem from "./HintSystem";
import { NUM_CARDS, Suit } from "./constants/deck";
import { PileId, TABLEAU_PILES } from "./constants/table";

const NUM_VALUES = 13;

export default class Deck {
  public cards: Card[] = [];

  public constructor(scene: Phaser.Scene) {
    for (let i = 1; i < NUM_VALUES + 1; i += 1) {
      Object.values(Suit).forEach((t) => {
        this.cards.push(new Card(scene, t, i));
      });
    }

    this.shuffle(this.cards);
    this.deal(scene);
  }

  public deal(scene: Phaser.Scene): void {
    // Flip all back
    this.cards.forEach((card: Card) => {
      card.flipBack(scene);
  
    });

    // Set positions
    let x = 0;
    for (let i = 0; i < TABLEAU_PILES.length; i += 1) {
      for (let t = 0; t < i + 1; t += 1) {
        this.cards[x].reposition(TABLEAU_PILES[i], t);

        if (i === t) {
          this.cards[x].flip(scene);
        }

        x += 1;
      }
    }

    // Rest go in stack
    for (let i = x; i < NUM_CARDS; i += 1) {
      this.cards[i].reposition(PileId.Stock, i - x);
    }
  }

  public activateTapMode(){
    this.cards.forEach((card: Card) => {
      if(card.flipped){
        card.on('pointerup', () => {
          Card.hintSys.moveCardOnClick(card);
        });
      }
  
    });
  }

  public shuffle(a: Card[]): Card[] {
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  public cardChildren(card: Card): Card[] {
    return this.cards
      .filter(
        (curr: Card) =>
          curr.pile === card.pile && curr.position >= card.position
      )
      .sort((a: Card, b: Card) => a.position - b.position);
  }

  public topCard(pile: PileId): Card | null {
    return (
      this.cards
        .filter((curr: Card) => curr.pile === pile)
        .sort((a: Card, b: Card) => a.position - b.position)
        .pop() ?? null
    );
  }

  public countCards(pile: PileId): number {
    return this.cards.reduce(
      (acc: number, card: Card) => (card.pile === pile ? acc + 1 : acc),
      0
    );
  }

  public faceUpCards(pile: PileId): Card[] {
    return this.cards
      .filter((card: Card) => card.pile === pile && card.flipped);
  }

  public areAllCardsFaceUp(): boolean {
    // Check if all cards are face-up
    return this.cards.every((card: Card) => card.flipped);
  }

  public makeAllCardsInactive(): void {
    this.cards.forEach((card: Card) => {
      card.disableInteractive();
    });
  }

  public makeAllCardsActive(): void {
    this.cards.forEach((card: Card) => {
      card.setInteractive();
    });
  }
}
