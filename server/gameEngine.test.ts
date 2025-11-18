import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialState,
  rollDice,
  validateAction,
  applyAction,
  checkGameEnd,
  calculateNetWorth,
} from "./gameEngine";
import { BoardConfig, GameAction, GameState } from "@/lib/types";

const mockBoardConfig: BoardConfig = {
  tiles: [
    { id: "start", type: "START", name: "GO", position: 0 },
    {
      id: "property-1",
      type: "PROPERTY",
      name: "Test Property",
      position: 1,
      price: 100,
      rent: 10,
      colorGroup: "brown",
    },
    {
      id: "property-2",
      type: "PROPERTY",
      name: "Another Property",
      position: 2,
      price: 150,
      rent: 15,
      colorGroup: "brown",
    },
    { id: "chance-1", type: "CHANCE", name: "Chance", position: 3 },
  ],
};

describe("gameEngine", () => {
  describe("createInitialState", () => {
    it("should create initial game state with correct player setup", () => {
      const playerIds = ["player1", "player2"];
      const userIds = ["user1", "user2"];
      const state = createInitialState(mockBoardConfig, playerIds, userIds, 100);

      expect(state.players).toHaveLength(2);
      expect(state.players[0].id).toBe("player1");
      expect(state.players[0].userId).toBe("user1");
      expect(state.players[0].balance).toBe(1500);
      expect(state.players[0].position).toBe(0);
      expect(state.players[0].active).toBe(true);
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.phase).toBe("ROLL");
      expect(state.cardDecks).toBeDefined();
      expect(state.tradeProposals).toEqual([]);
    });
  });

  describe("rollDice", () => {
    it("should return two numbers between 1 and 6", () => {
      const [die1, die2] = rollDice();
      expect(die1).toBeGreaterThanOrEqual(1);
      expect(die1).toBeLessThanOrEqual(6);
      expect(die2).toBeGreaterThanOrEqual(1);
      expect(die2).toBeLessThanOrEqual(6);
    });
  });

  describe("validateAction", () => {
    let state: GameState;

    beforeEach(() => {
      state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"]
      );
    });

    it("should reject action from wrong player", () => {
      const action: GameAction = { type: "ROLL_DICE" };
      const result = validateAction(state, action, "player2", mockBoardConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Not your turn");
    });

    it("should accept valid ROLL_DICE action", () => {
      const action: GameAction = { type: "ROLL_DICE" };
      const result = validateAction(state, action, "player1", mockBoardConfig);
      expect(result.valid).toBe(true);
    });

    it("should reject ROLL_DICE when phase is not ROLL", () => {
      state.phase = "ACTION";
      const action: GameAction = { type: "ROLL_DICE" };
      const result = validateAction(state, action, "player1", mockBoardConfig);
      expect(result.valid).toBe(false);
    });

    it("should validate BUY_PROPERTY action", () => {
      state.phase = "ACTION";
      state.players[0].position = 1; // On property tile
      state.players[0].balance = 200; // Enough money

      const action: GameAction = {
        type: "BUY_PROPERTY",
        tileId: "property-1",
      };
      const result = validateAction(state, action, "player1", mockBoardConfig);
      expect(result.valid).toBe(true);
    });

    it("should reject BUY_PROPERTY with insufficient balance", () => {
      state.phase = "ACTION";
      state.players[0].position = 1;
      state.players[0].balance = 50; // Not enough

      const action: GameAction = {
        type: "BUY_PROPERTY",
        tileId: "property-1",
      };
      const result = validateAction(state, action, "player1", mockBoardConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Insufficient balance");
    });
  });

  describe("applyAction", () => {
    let state: GameState;

    beforeEach(() => {
      state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"]
      );
    });

    it("should move player on ROLL_DICE", () => {
      const action: GameAction = { type: "ROLL_DICE" };
      const newState = applyAction(state, action, mockBoardConfig);

      // Player should have moved (position changed or dice rolled)
      expect(newState.diceRoll).toBeDefined();
      expect(newState.diceRoll?.length).toBe(2);
    });

    it("should buy property and reduce balance", () => {
      state.phase = "ACTION";
      state.players[0].position = 1;
      state.players[0].balance = 200;

      const action: GameAction = {
        type: "BUY_PROPERTY",
        tileId: "property-1",
      };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.players[0].properties).toContain("property-1");
      expect(newState.players[0].balance).toBe(100); // 200 - 100
      expect(newState.phase).toBe("END_TURN");
    });

    it("should end turn and switch to next player", () => {
      state.phase = "END_TURN";
      const action: GameAction = { type: "END_TURN" };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.currentPlayerIndex).toBe(1);
      expect(newState.phase).toBe("ROLL");
      expect(newState.turnNumber).toBe(2);
    });

    it("should charge rent when landing on owned property", () => {
      // Setup: player2 owns property-1, player1 lands on it
      state.players[1].properties = ["property-1"];
      state.players[0].position = 1;
      state.players[0].balance = 200;
      state.players[1].balance = 1500;

      const action: GameAction = {
        type: "PAY_RENT",
        tileId: "property-1",
        amount: 10,
      };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.players[0].balance).toBe(190); // 200 - 10
      expect(newState.players[1].balance).toBe(1510); // 1500 + 10
    });
  });

  describe("checkGameEnd", () => {
    it("should detect game end when only one active player remains", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        100
      );
      state.players[1].active = false; // Bankrupt

      const result = checkGameEnd(state, mockBoardConfig);
      expect(result.ended).toBe(true);
      expect(result.winnerId).toBe("player1");
      expect(result.reason).toBe("last_player_standing");
    });

    it("should not end game when multiple players remain", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        100
      );

      const result = checkGameEnd(state, mockBoardConfig);
      expect(result.ended).toBe(false);
    });

    it("should end game when turn limit reached", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        5
      );
      state.turnNumber = 5;
      state.players[0].balance = 2000;
      state.players[1].balance = 1000;

      const result = checkGameEnd(state, mockBoardConfig);
      expect(result.ended).toBe(true);
      expect(result.winnerId).toBe("player1");
      expect(result.reason).toBe("turn_limit_reached");
    });
  });

  describe("calculateNetWorth", () => {
    it("should calculate net worth correctly", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1"],
        ["user1"],
        100
      );
      const player = state.players[0];
      player.properties = ["property-1", "property-2"];
      player.balance = 500;

      const netWorth = calculateNetWorth(player, mockBoardConfig);
      expect(netWorth).toBe(500 + 100 + 150); // balance + property prices
    });
  });

  describe("bankruptcy", () => {
    it("should handle bankruptcy declaration", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        100
      );

      const action: GameAction = { type: "DECLARE_BANKRUPTCY" };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.players[0].active).toBe(false);
      expect(newState.players[0].balance).toBe(0);
      expect(newState.players[0].properties).toEqual([]);
    });
  });

  describe("cards", () => {
    it("should draw and resolve card", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1"],
        ["user1"],
        100
      );
      state.players[0].position = 3; // On chance tile
      state.phase = "ACTION";

      const drawAction: GameAction = { type: "DRAW_CARD" };
      const stateAfterDraw = applyAction(state, drawAction, mockBoardConfig);

      expect(stateAfterDraw.currentCard).toBeDefined();
      expect(stateAfterDraw.phase).toBe("ACTION");

      const resolveAction: GameAction = { type: "RESOLVE_CARD" };
      const stateAfterResolve = applyAction(stateAfterDraw, resolveAction, mockBoardConfig);

      expect(stateAfterResolve.currentCard).toBeUndefined();
      expect(stateAfterResolve.phase).toBe("END_TURN");
    });
  });

  describe("trading", () => {
    it("should handle trade proposal and acceptance", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        100
      );

      // Player 1 buys property-1
      state.phase = "ACTION";
      state.players[0].position = 1;
      state.players[0].balance = 200;
      let newState = applyAction(state, { type: "BUY_PROPERTY", tileId: "property-1" }, mockBoardConfig);

      // Player 2 buys property-2
      newState.currentPlayerIndex = 1;
      newState.phase = "ACTION";
      newState.players[1].position = 2;
      newState.players[1].balance = 200;
      newState = applyAction(newState, { type: "BUY_PROPERTY", tileId: "property-2" }, mockBoardConfig);

      // Player 1 proposes trade
      newState.currentPlayerIndex = 0;
      newState.phase = "ACTION";
      const proposeAction: GameAction = {
        type: "PROPOSE_TRADE",
        proposal: {
          fromPlayerId: "player1",
          toPlayerId: "player2",
          offeredPropertyIds: ["property-1"],
          requestedPropertyIds: ["property-2"],
        }
      };
      newState = applyAction(newState, proposeAction, mockBoardConfig);

      expect(newState.tradeProposals.length).toBe(1);
      expect(newState.tradeProposals[0].status).toBe("PENDING");

      // Player 2 accepts
      const acceptAction: GameAction = {
        type: "ACCEPT_TRADE",
        proposalId: newState.tradeProposals[0].id,
      };
      newState = applyAction(newState, acceptAction, mockBoardConfig);

      expect(newState.tradeProposals[0].status).toBe("ACCEPTED");
      expect(newState.players[0].properties).toContain("property-2");
      expect(newState.players[1].properties).toContain("property-1");
    });
  });

  describe("negative paths", () => {
    it("should reject action from inactive player", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        100
      );
      state.players[0].active = false;

      const action: GameAction = { type: "ROLL_DICE" };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.lastAction).toContain("bankrupt");
      expect(newState.players[0].position).toBe(0); // Position unchanged
    });

    it("should reject double roll in same turn", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1"],
        ["user1"],
        100
      );
      state.diceRoll = [3, 4];
      state.phase = "ACTION";

      const action: GameAction = { type: "ROLL_DICE" };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.lastAction).toContain("already rolled");
      expect(newState.diceRoll).toEqual([3, 4]); // Unchanged
    });

    it("should reject buying already owned property", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        100
      );
      state.phase = "ACTION";
      state.players[0].position = 1;
      state.players[0].balance = 200;
      state.players[1].properties = ["property-1"]; // Player 2 owns it

      const action: GameAction = { type: "BUY_PROPERTY", tileId: "property-1" };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.lastAction).toContain("already owned");
      expect(newState.players[0].properties).not.toContain("property-1");
      expect(newState.players[0].balance).toBe(200); // Unchanged
    });

    it("should reject trade proposal with insufficient balance", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        100
      );
      state.phase = "ACTION";
      state.players[0].properties = ["property-1"];
      state.players[0].balance = 50; // Not enough
      state.players[1].properties = ["property-2"];

      const action: GameAction = {
        type: "PROPOSE_TRADE",
        proposal: {
          fromPlayerId: "player1",
          toPlayerId: "player2",
          offeredPropertyIds: ["property-1"],
          requestedPropertyIds: ["property-2"],
          cashFromFromPlayer: 100, // More than balance
        }
      };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.lastAction).toContain("Insufficient balance");
      expect(newState.tradeProposals.length).toBe(0);
    });

    it("should handle rent payment when owner is bankrupt", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1", "player2"],
        ["user1", "user2"],
        100
      );
      state.players[1].properties = ["property-1"];
      state.players[1].active = false; // Owner is bankrupt
      state.players[0].position = 1;
      state.phase = "ACTION";

      // Simulate landing on property
      const rollAction: GameAction = { type: "ROLL_DICE" };
      const newState = applyAction(state, rollAction, mockBoardConfig);

      // Should not pay rent to bankrupt owner
      expect(newState.lastAction).toContain("bankrupt");
      expect(newState.players[0].balance).toBe(1500); // Unchanged
    });

    it("should reject drawing card when one is pending", () => {
      const state = createInitialState(
        mockBoardConfig,
        ["player1"],
        ["user1"],
        100
      );
      state.players[0].position = 3; // On chance tile
      state.phase = "ACTION";
      state.currentCard = {
        id: "test-card",
        deck: "TREND",
        title: "Test",
        description: "Test card",
        effectType: "BALANCE_DELTA",
        amount: 100,
      };

      const action: GameAction = { type: "DRAW_CARD" };
      const newState = applyAction(state, action, mockBoardConfig);

      expect(newState.lastAction).toContain("already drawn");
      expect(newState.currentCard).toEqual(state.currentCard); // Unchanged
    });
  });
});

