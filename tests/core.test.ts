import { describe, expect, it } from "vitest";
import { boardKey, cloneBoard, createBoard, transferCards } from "../src/core/board";
import { createCards, Suit } from "../src/core/cards";
import { GameSession } from "../src/core/GameSession";
import { MaxHeap } from "../src/core/heap";
import { decodeMoves, drawMove, encodeMoves, transfer } from "../src/core/moves";
import { createRng, shuffle } from "../src/core/random";

describe("cards", () => {
  it("builds a standard deck of 52 unique cards", () => {
    const cards = createCards(52);
    expect(cards).toHaveLength(52);
    expect(new Set(cards.map((card) => `${card.suit}-${card.rank}`)).size).toBe(52);
  });

  it("builds a one-suit Spider pack", () => {
    const cards = createCards(104, [Suit.Spades]);
    expect(cards.every((card) => card.suit === Suit.Spades)).toBe(true);
    expect(cards.filter((card) => card.rank === 1)).toHaveLength(8);
  });
});

describe("random", () => {
  it("is deterministic per seed", () => {
    const a = shuffle([...Array(52).keys()], createRng(42));
    const b = shuffle([...Array(52).keys()], createRng(42));
    const c = shuffle([...Array(52).keys()], createRng(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("board", () => {
  it("transfers cards and keeps face-down counts consistent", () => {
    const board = createBoard(2);
    board.piles[0].push(1, 2, 3);
    board.hidden[0] = 3;
    transferCards(board, 0, 1, 2);
    expect(board.piles).toEqual([[1], [2, 3]]);
    expect(board.hidden[0]).toBe(1);
  });

  it("clones deeply", () => {
    const board = createBoard(1);
    board.piles[0].push(5);
    const copy = cloneBoard(board);
    copy.piles[0].push(6);
    expect(board.piles[0]).toEqual([5]);
  });

  it("gives permuted symmetric piles the same key", () => {
    const a = createBoard(3);
    a.piles[0].push(1);
    a.piles[1].push(2);
    const b = createBoard(3);
    b.piles[0].push(2);
    b.piles[1].push(1);
    expect(boardKey(a, { symmetricGroups: [[0, 1]] })).toBe(boardKey(b, { symmetricGroups: [[0, 1]] }));
    expect(boardKey(a)).not.toBe(boardKey(b));
  });
});

describe("moves", () => {
  it("round-trips through the compact encoding", () => {
    const moves = [transfer(3, 12, 4), drawMove, { kind: "pair", a: 27, b: 29 } as const, transfer(0, 61, 1)];
    expect(decodeMoves(encodeMoves(moves))).toEqual(moves);
  });
});

describe("heap", () => {
  it("pops by priority, FIFO among equals", () => {
    const heap = new MaxHeap<string>();
    heap.push("a", 1);
    heap.push("b", 5);
    heap.push("c", 1);
    heap.push("d", 3);
    expect([heap.pop(), heap.pop(), heap.pop(), heap.pop(), heap.pop()]).toEqual(["b", "d", "a", "c", undefined]);
  });
});

describe("GameSession", async () => {
  const { klondike } = await import("../src/variants/klondike");

  it("plays, scores and undoes moves", () => {
    const session = new GameSession(klondike.createRules("easy"), 7);
    const start = session.board;
    expect(session.play(drawMove)).not.toBeNull();
    expect(session.moves).toBe(1);
    expect(session.board).not.toBe(start);
    session.undo();
    expect(session.board).toBe(start);
    expect(session.moves).toBe(0);
    expect(session.canUndo).toBe(false);
  });

  it("rejects illegal moves", () => {
    const session = new GameSession(klondike.createRules("easy"), 7);
    // Moving a card onto the stock is never legal.
    expect(session.play(transfer(6, 0, 1))).toBeNull();
  });
});

describe("GameSession undo grouping", async () => {
  const { klondike } = await import("../src/variants/klondike");

  it("undoes automatic moves together with the player move before them", () => {
    const session = new GameSession(klondike.createRules("easy"), 7);
    const start = session.board;
    session.play(drawMove);
    session.play(drawMove, true);
    session.play(drawMove, true);
    expect(session.moves).toBe(3);
    session.undo();
    expect(session.board).toBe(start);
    expect(session.movesPlayed).toHaveLength(0);
  });
});
