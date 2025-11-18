import { BoardConfig, BoardTile, GameState, PlayerState, GameAction, CardDefinition, TradeProposal } from "@/lib/types";
import { initializeDecks, getCardById, drawCard } from "@/config/cards";

const STARTING_BALANCE = 1500;
const JAIL_POSITION = 10;
const GO_POSITION = 0;
const DEFAULT_TURN_LIMIT = 100; // Optional: can be configured per game

/**
 * Advances to the next active player in the game
 * Skips bankrupt/inactive players
 * Resets phase to ROLL, clears dice roll, increments turn number
 * 
 * @param state Current game state
 * @returns New game state with advanced player
 */
export function advanceToNextPlayer(state: GameState): GameState {
  const totalPlayers = state.players.length;
  if (totalPlayers === 0) return state;

  let nextIndex = state.currentPlayerIndex;
  let attempts = 0;
  const maxAttempts = totalPlayers;

  // Find next active player (skip bankrupt players)
  for (let i = 0; i < maxAttempts; i++) {
    nextIndex = (nextIndex + 1) % totalPlayers;
    const player = state.players[nextIndex];
    
    // Check if player is active (not bankrupt)
    if (player.active !== false) {
      // Found next active player
      state.currentPlayerIndex = nextIndex;
      state.turnNumber += 1;
      state.phase = "ROLL";
      state.diceRoll = undefined;
      console.log(`[advanceToNextPlayer] Turn switched: player ${nextIndex} (${player.userId}), turn ${state.turnNumber}`);
      return state;
    }
    attempts++;
  }

  // If all players are inactive, keep current (shouldn't happen, but safety)
  console.warn("[advanceToNextPlayer] All players inactive, keeping current player");
  state.phase = "ROLL";
  state.diceRoll = undefined;
  return state;
}

export function createInitialState(
  boardConfig: BoardConfig,
  playerIds: string[],
  userIds: string[],
  turnLimit?: number
): GameState {
  const players: PlayerState[] = playerIds.map((id, index) => ({
    id,
    userId: userIds[index],
    position: 0,
    balance: STARTING_BALANCE,
    properties: [],
    inJail: false,
    jailTurns: 0,
    active: true,
    getOutOfJailCards: 0,
  }));

  const decks = initializeDecks();

  return {
    currentPlayerIndex: 0,
    players,
    phase: "ROLL",
    turnNumber: 1,
    tradeProposals: [],
    cardDecks: decks,
    turnLimit: turnLimit || DEFAULT_TURN_LIMIT,
    gameJustStarted: false, // Will be set to true if game just started
    minTurnsBeforeEnd: 0, // Minimum turns before game can end (for single-player with bot)
  };
}

export function rollDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

export function validateAction(
  state: GameState,
  action: GameAction,
  playerId: string,
  boardConfig: BoardConfig
): { valid: boolean; error?: string } {
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (currentPlayer.id !== playerId) {
    return { valid: false, error: "Not your turn" };
  }

  switch (action.type) {
    case "ROLL_DICE":
      if (state.phase !== "ROLL") {
        return { valid: false, error: "Cannot roll dice now" };
      }
      if (currentPlayer.inJail && currentPlayer.jailTurns < 3) {
        return { valid: true }; // Can roll to get out of jail
      }
      if (currentPlayer.inJail && currentPlayer.jailTurns >= 3) {
        return { valid: false, error: "Must pay to get out of jail" };
      }
      return { valid: true };

    case "END_TURN":
      if (state.phase !== "END_TURN") {
        return { valid: false, error: "Cannot end turn now" };
      }
      return { valid: true };

    case "BUY_PROPERTY":
      if (state.phase !== "ACTION") {
        console.log("[BUY_PROPERTY VALIDATION FAILED] Wrong phase", {
          phase: state.phase,
          currentPlayerIndex: state.currentPlayerIndex,
          position: currentPlayer?.position,
        });
        return { valid: false, error: "Cannot buy property now" };
      }
      const tile = boardConfig.tiles.find((t) => t.id === action.tileId);
      if (!tile || tile.type !== "PROPERTY") {
        return { valid: false, error: "Invalid property" };
      }
      if (tile.price && currentPlayer.balance < tile.price) {
        return { valid: false, error: "Insufficient balance" };
      }
      if (currentPlayer.properties.includes(action.tileId)) {
        return { valid: false, error: "Already own this property" };
      }
      // Check if someone else owns it
      const owner = state.players.find((p) => p.properties.includes(action.tileId));
      if (owner) {
        return { valid: false, error: "Property already owned" };
      }
      return { valid: true };

    case "PAY_RENT":
      if (state.phase !== "ACTION") {
        return { valid: false, error: "Cannot pay rent now" };
      }
      const rentTile = boardConfig.tiles.find((t) => t.id === action.tileId);
      if (!rentTile || rentTile.type !== "PROPERTY") {
        return { valid: false, error: "Invalid property" };
      }
      const rentOwner = state.players.find((p) => p.properties.includes(action.tileId));
      if (!rentOwner) {
        return { valid: false, error: "Property not owned" };
      }
      if (currentPlayer.balance < action.amount) {
        return { valid: false, error: "Insufficient balance" };
      }
      return { valid: true };

    case "SKIP_BUY":
      if (state.phase !== "ACTION") {
        return { valid: false, error: "Cannot skip buy now" };
      }
      return { valid: true };

    case "DRAW_CARD":
      if (state.phase !== "ACTION") {
        return { valid: false, error: "Cannot draw card now" };
      }
      return { valid: true };

    case "RESOLVE_CARD":
      if (state.phase !== "ACTION" || !state.currentCard) {
        return { valid: false, error: "No card to resolve" };
      }
      return { valid: true };

    case "USE_JAIL_CARD":
      if (!currentPlayer.inJail || currentPlayer.getOutOfJailCards === 0) {
        return { valid: false, error: "Cannot use jail card" };
      }
      return { valid: true };

    case "PAY_TAX":
      if (state.phase !== "ACTION") {
        return { valid: false, error: "Cannot pay tax now" };
      }
      if (currentPlayer.balance < action.amount) {
        return { valid: false, error: "Insufficient balance" };
      }
      return { valid: true };

    case "DECLARE_BANKRUPTCY":
      return { valid: true }; // Can declare bankruptcy at any time

    case "PROPOSE_TRADE": {
      if (state.phase !== "ACTION" && state.phase !== "END_TURN") {
        return { valid: false, error: "Cannot propose trade now" };
      }
      const fromPlayer = state.players.find(p => p.id === action.proposal.fromPlayerId);
      const toPlayer = state.players.find(p => p.id === action.proposal.toPlayerId);
      
      if (!fromPlayer || !toPlayer || !fromPlayer.active || !toPlayer.active) {
        return { valid: false, error: "Invalid players for trade" };
      }
      
      // Validate ownership
      const fromOwnsAll = action.proposal.offeredPropertyIds.every(id => fromPlayer.properties.includes(id));
      const toOwnsAll = action.proposal.requestedPropertyIds.every(id => toPlayer.properties.includes(id));
      
      if (!fromOwnsAll || !toOwnsAll) {
        return { valid: false, error: "Players don't own all specified properties" };
      }
      
      return { valid: true };
    }

    case "ACCEPT_TRADE": {
      const proposal = state.tradeProposals.find(p => p.id === action.proposalId && p.status === "PENDING");
      if (!proposal) {
        return { valid: false, error: "Trade proposal not found" };
      }
      if (proposal.toPlayerId !== playerId) {
        return { valid: false, error: "Only the recipient can accept" };
      }
      return { valid: true };
    }

    case "DECLINE_TRADE": {
      const proposal = state.tradeProposals.find(p => p.id === action.proposalId && p.status === "PENDING");
      if (!proposal) {
        return { valid: false, error: "Trade proposal not found" };
      }
      if (proposal.toPlayerId !== playerId) {
        return { valid: false, error: "Only the recipient can decline" };
      }
      return { valid: true };
    }

    case "CANCEL_TRADE": {
      const proposal = state.tradeProposals.find(p => p.id === action.proposalId && p.status === "PENDING");
      if (!proposal) {
        return { valid: false, error: "Trade proposal not found" };
      }
      if (proposal.fromPlayerId !== playerId) {
        return { valid: false, error: "Only the proposer can cancel" };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: "Unknown action" };
  }
}

export function applyAction(
  state: GameState,
  action: GameAction,
  boardConfig: BoardConfig
): GameState {
  // Create deep copy to avoid mutating input state
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const currentPlayer = { ...newState.players[newState.currentPlayerIndex] };
  
  // Check if current player is active
  if (!currentPlayer.active) {
    // Return state unchanged with error message
    newState.lastAction = "Cannot perform action: player is bankrupt";
    return newState;
  }

  switch (action.type) {
    case "ROLL_DICE": {
      // Prevent double roll in same turn
      if (newState.diceRoll && newState.phase !== "ROLL") {
        newState.lastAction = "Cannot roll dice: already rolled this turn";
        return newState;
      }

      const [die1, die2] = rollDice();
      newState.diceRoll = [die1, die2];
      const total = die1 + die2;

      if (currentPlayer.inJail) {
        if (die1 === die2) {
          // Get out of jail free
          currentPlayer.inJail = false;
          currentPlayer.jailTurns = 0;
          currentPlayer.position = (currentPlayer.position + total) % boardConfig.tiles.length;
        } else {
          currentPlayer.jailTurns += 1;
          if (currentPlayer.jailTurns >= 3) {
            // Must pay to get out
            currentPlayer.balance -= 50;
            currentPlayer.inJail = false;
            currentPlayer.jailTurns = 0;
            currentPlayer.position = (currentPlayer.position + total) % boardConfig.tiles.length;
          }
        }
      } else {
        currentPlayer.position = (currentPlayer.position + total) % boardConfig.tiles.length;
      }

      // Check for passing GO
      if (currentPlayer.position < (currentPlayer.position - total + boardConfig.tiles.length) % boardConfig.tiles.length) {
        currentPlayer.balance += 200; // Pass GO bonus
      }

      // Check what tile we landed on
      const landedTile = boardConfig.tiles[currentPlayer.position];
      newState.lastAction = `${currentPlayer.userId} rolled ${total} and landed on ${landedTile.name}`;

      // Handle special tiles
      if (landedTile.type === "GO_TO_JAIL") {
        currentPlayer.position = JAIL_POSITION;
        currentPlayer.inJail = true;
        currentPlayer.jailTurns = 0;
        newState.lastAction = `${currentPlayer.userId} went to jail`;
      } else if (landedTile.type === "START") {
        currentPlayer.balance += 200; // Land on GO
      } else if (landedTile.type === "TAX") {
        const taxAmount = (landedTile as any).amount || 200;
        currentPlayer.balance -= taxAmount;
        newState.lastAction = `${currentPlayer.userId} paid ${taxAmount} in taxes`;
      } else if (landedTile.type === "PROPERTY") {
        // Check if owned
        const owner = newState.players.find((p) => p.properties.includes(landedTile.id));
        if (owner && owner.id !== currentPlayer.id) {
          // Owner must be active to receive rent
          if (!owner.active) {
            // Property owner is bankrupt - no rent paid
            newState.lastAction = `${currentPlayer.userId} landed on ${landedTile.name} (owner bankrupt - no rent)`;
            newState.phase = "END_TURN";
          } else {
            // Pay rent
              const rent = landedTile.rent || 0;
            if (currentPlayer.balance < rent) {
              // Cannot pay rent - will go bankrupt
              // Pay what they can, then mark as bankrupt (will be handled in bankruptcy check)
              const canPay = currentPlayer.balance;
              owner.balance += canPay;
              currentPlayer.balance = -1; // Set to negative to trigger bankruptcy check
              newState.lastAction = `${currentPlayer.userId} cannot pay full ${rent} rent (paid ${canPay}). Going bankrupt.`;
              newState.phase = "END_TURN";
            } else {
              currentPlayer.balance -= rent;
              owner.balance += rent;
              newState.lastAction = `${currentPlayer.userId} paid ${rent} rent to ${owner.userId}`;
              newState.phase = "END_TURN";
            }
          }
        } else if (!owner) {
          // Can buy
          newState.phase = "ACTION";
        } else {
          // Own property
          newState.phase = "END_TURN";
        }
      } else if (landedTile.type === "CHANCE") {
        newState.phase = "ACTION";
      } else {
        newState.phase = "END_TURN";
      }

      newState.players[newState.currentPlayerIndex] = currentPlayer;
      break;
    }

    case "BUY_PROPERTY": {
      const currentPlayer = newState.players[newState.currentPlayerIndex];
      
      // Guard: Покупать можно только в фазе ACTION
      if (newState.phase !== "ACTION") {
        console.log("[BUY_PROPERTY GUARD FAILED] Wrong phase", {
          phase: newState.phase,
          currentPlayerIndex: newState.currentPlayerIndex,
          position: currentPlayer?.position,
        });
        newState.lastAction = "Cannot buy property now";
        return newState;
      }

      const tile = boardConfig.tiles.find((t) => t.id === action.tileId);
      if (!tile || tile.type !== "PROPERTY") {
        console.log("[BUY_PROPERTY GUARD FAILED] Invalid tile", {
          tileId: action.tileId,
          tileType: tile?.type,
        });
        newState.lastAction = "Current tile is not a property";
        return newState;
      }

      // Check if already owned
      const owner = newState.players.find((p) => p.properties.includes(action.tileId));
      if (owner) {
        console.log("[BUY_PROPERTY GUARD FAILED] Property already owned", {
          tileId: action.tileId,
          ownerId: owner.id,
        });
        newState.lastAction = "Property already owned";
        return newState;
      }

      // Check balance
      if (!tile.price) {
        console.log("[BUY_PROPERTY GUARD FAILED] Tile has no price", {
          tileId: action.tileId,
        });
        newState.lastAction = "Property has no price";
        return newState;
      }

      if (currentPlayer.balance < tile.price) {
        console.log("[BUY_PROPERTY GUARD FAILED] Insufficient balance", {
          balance: currentPlayer.balance,
          price: tile.price,
        });
        newState.lastAction = "Not enough balance";
        return newState;
      }

      // Списываем деньги и назначаем владельца
      currentPlayer.balance -= tile.price;
      currentPlayer.properties.push(action.tileId);
      newState.lastAction = `${currentPlayer.userId} bought ${tile.name} for ${tile.price}`;
      newState.players[newState.currentPlayerIndex] = currentPlayer;

      // Переходим к следующему игроку
      const updatedState = advanceToNextPlayer(newState);
      console.log(`[BUY_PROPERTY] Player ${currentPlayer.userId} bought ${tile.name}, next player: ${updatedState.currentPlayerIndex}, turn: ${updatedState.turnNumber}`);
      return updatedState;
    }

    case "PAY_RENT": {
      const owner = newState.players.find((p) => p.properties.includes(action.tileId));
      if (owner) {
        currentPlayer.balance -= action.amount;
        owner.balance += action.amount;
        newState.lastAction = `${currentPlayer.userId} paid ${action.amount} rent`;
      }
      newState.phase = "END_TURN";
      newState.players[newState.currentPlayerIndex] = currentPlayer;
      break;
    }

    case "DRAW_CARD": {
      // Prevent drawing card if one is already pending
      if (newState.currentCard) {
        newState.lastAction = "Card already drawn - resolve it first";
        return newState;
      }

      const currentTile = boardConfig.tiles[currentPlayer.position];
      if (currentTile.type !== "CHANCE" && currentTile.type !== "FREE_PARKING") {
        newState.lastAction = "Not on a card tile";
        return newState;
      }

      const deckType = currentTile.type === "CHANCE" ? "trend" : "pump";
      const deck = newState.cardDecks[deckType];
      
      if (!deck || deck.length === 0) {
        newState.lastAction = "Card deck is empty";
        return newState;
      }
      
      const drawResult = drawCard(deck);
      if (drawResult) {
        newState.cardDecks[deckType] = drawResult.newDeck;
        const card = getCardById(drawResult.cardId);
        if (card) {
          newState.currentCard = card;
          newState.phase = "ACTION"; // Wait for RESOLVE_CARD
        }
      }
      newState.players[newState.currentPlayerIndex] = currentPlayer;
      break;
    }

    case "RESOLVE_CARD": {
      if (!newState.currentCard) break;
      
      const card = newState.currentCard;
      let logMessage = `${currentPlayer.userId}: ${card.title} - ${card.description}`;
      
      switch (card.effectType) {
        case "BALANCE_DELTA":
          if (card.amount) {
            currentPlayer.balance += card.amount;
            logMessage += ` (${card.amount > 0 ? "+" : ""}${card.amount})`;
          }
          break;
          
        case "MOVE_RELATIVE":
          if (card.moveSpaces) {
            const oldPos = currentPlayer.position;
            currentPlayer.position = (currentPlayer.position + card.moveSpaces) % boardConfig.tiles.length;
            if (currentPlayer.position < oldPos) {
              currentPlayer.balance += 200; // Passed GO
            }
            if (card.amount) {
              currentPlayer.balance += card.amount;
            }
          }
          break;
          
        case "MOVE_TO_TILE":
          if (card.targetTileId) {
            const targetTile = boardConfig.tiles.find(t => t.id === card.targetTileId);
            if (targetTile) {
              const oldPos = currentPlayer.position;
              currentPlayer.position = targetTile.position;
              if (currentPlayer.position < oldPos) {
                currentPlayer.balance += 200; // Passed GO
              }
            }
          } else {
            // Move to nearest unowned property
            let nearestTile = null;
            let minDistance = Infinity;
            for (const tile of boardConfig.tiles) {
              if (tile.type === "PROPERTY" && !newState.players.some(p => p.properties.includes(tile.id))) {
                const distance = (tile.position - currentPlayer.position + boardConfig.tiles.length) % boardConfig.tiles.length;
                if (distance < minDistance && distance > 0) {
                  minDistance = distance;
                  nearestTile = tile;
                }
              }
            }
            if (nearestTile) {
              const oldPos = currentPlayer.position;
              currentPlayer.position = nearestTile.position;
              if (currentPlayer.position < oldPos) {
                currentPlayer.balance += 200; // Passed GO
              }
              newState.phase = "ACTION"; // Can buy the property
            }
          }
          if (card.amount) {
            currentPlayer.balance += card.amount;
          }
          break;
          
        case "GO_TO_JAIL":
          currentPlayer.position = JAIL_POSITION;
          currentPlayer.inJail = true;
          currentPlayer.jailTurns = 0;
          break;
          
        case "GET_OUT_OF_JAIL":
          currentPlayer.getOutOfJailCards += 1;
          break;
          
        case "GLOBAL_EVENT":
          if (card.globalAmountPerPlayer) {
            const otherPlayers = newState.players.filter(p => p.id !== currentPlayer.id && p.active);
            for (const otherPlayer of otherPlayers) {
              if (card.globalAmountPerPlayer! > 0) {
                // Other players pay current player
                const amount = Math.min(card.globalAmountPerPlayer!, otherPlayer.balance);
                otherPlayer.balance -= amount;
                currentPlayer.balance += amount;
              } else {
                // Current player pays others
                const amount = Math.min(-card.globalAmountPerPlayer!, currentPlayer.balance);
                currentPlayer.balance -= amount;
                otherPlayer.balance += amount;
              }
            }
          }
          break;
      }
      
      newState.lastAction = logMessage;
      newState.currentCard = undefined;
      newState.phase = "END_TURN";
      newState.players[newState.currentPlayerIndex] = currentPlayer;
      break;
    }

    case "USE_JAIL_CARD": {
      if (currentPlayer.getOutOfJailCards > 0 && currentPlayer.inJail) {
        currentPlayer.getOutOfJailCards -= 1;
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
        newState.lastAction = `${currentPlayer.userId} used Get Out of Jail Free card`;
        newState.phase = "ROLL";
      }
      newState.players[newState.currentPlayerIndex] = currentPlayer;
      break;
    }

    case "SKIP_BUY": {
      /**
       * After skipping buy:
       * - Automatically advance to next player (no need for explicit END_TURN)
       * - This allows seamless flow: ROLL_DICE → ACTION (BUY/SKIP) → next player
       */
      newState.lastAction = `${currentPlayer.userId} skipped buying property`;
      newState.players[newState.currentPlayerIndex] = currentPlayer;
      
      // Automatically advance to next player
      const advancedState = advanceToNextPlayer(newState);
      console.log(`[SKIP_BUY] Player ${currentPlayer.userId} skipped buy, next player: ${advancedState.currentPlayerIndex}, turn: ${advancedState.turnNumber}`);
      return advancedState;
    }

    case "DECLARE_BANKRUPTCY": {
      currentPlayer.active = false;
      currentPlayer.balance = 0;
      currentPlayer.properties = [];
      newState.lastAction = `${currentPlayer.userId} declared bankruptcy`;
      newState.phase = "END_TURN";
      newState.players[newState.currentPlayerIndex] = currentPlayer;
      break;
    }

    case "PROPOSE_TRADE": {
      const proposal: TradeProposal = {
        id: `trade-${Date.now()}-${Math.random()}`,
        ...action.proposal,
        status: "PENDING",
      };
      
      // Validate: players own the properties
      const fromPlayer = newState.players.find(p => p.id === action.proposal.fromPlayerId);
      const toPlayer = newState.players.find(p => p.id === action.proposal.toPlayerId);
      
      if (!fromPlayer || !toPlayer) break;
      
      const fromOwnsAll = action.proposal.offeredPropertyIds.every(id => fromPlayer.properties.includes(id));
      const toOwnsAll = action.proposal.requestedPropertyIds.every(id => toPlayer.properties.includes(id));
      
      if (fromOwnsAll && toOwnsAll) {
        newState.tradeProposals.push(proposal);
        newState.lastAction = `${fromPlayer.userId} proposed a trade to ${toPlayer.userId}`;
        newState.phase = "AWAITING_TRADE_RESPONSE";
      }
      break;
    }

    case "ACCEPT_TRADE": {
      const proposal = newState.tradeProposals.find(p => p.id === action.proposalId && p.status === "PENDING");
      if (!proposal) {
        newState.lastAction = "Trade proposal not found or already processed";
        return newState;
      }
      
      const fromPlayer = newState.players.find(p => p.id === proposal.fromPlayerId);
      const toPlayer = newState.players.find(p => p.id === proposal.toPlayerId);
      
      if (!fromPlayer || !toPlayer) {
        newState.lastAction = "Players not found";
        return newState;
      }

      if (!fromPlayer.active || !toPlayer.active) {
        newState.lastAction = "Cannot trade with inactive players";
        return newState;
      }
      
      // Re-validate ownership (properties might have been sold)
      const fromOwnsAll = proposal.offeredPropertyIds.every(id => fromPlayer.properties.includes(id));
      const toOwnsAll = proposal.requestedPropertyIds.every(id => toPlayer.properties.includes(id));
      
      if (!fromOwnsAll || !toOwnsAll) {
        newState.lastAction = "Players no longer own all specified properties";
        return newState;
      }
      
      // Check balances
      if (proposal.cashFromFromPlayer && fromPlayer.balance < proposal.cashFromFromPlayer) {
        newState.lastAction = "Insufficient balance for trade";
        return newState;
      }
      if (proposal.cashFromToPlayer && toPlayer.balance < proposal.cashFromToPlayer) {
        newState.lastAction = "Counterparty has insufficient balance";
        return newState;
      }
      
      // Execute trade
      proposal.offeredPropertyIds.forEach(propId => {
        fromPlayer.properties = fromPlayer.properties.filter(id => id !== propId);
        toPlayer.properties.push(propId);
      });
      
      proposal.requestedPropertyIds.forEach(propId => {
        toPlayer.properties = toPlayer.properties.filter(id => id !== propId);
        fromPlayer.properties.push(propId);
      });
      
      if (proposal.cashFromFromPlayer) {
        fromPlayer.balance -= proposal.cashFromFromPlayer;
        toPlayer.balance += proposal.cashFromFromPlayer;
      }
      
      if (proposal.cashFromToPlayer) {
        toPlayer.balance -= proposal.cashFromToPlayer;
        fromPlayer.balance += proposal.cashFromToPlayer;
      }
      
      proposal.status = "ACCEPTED";
      newState.lastAction = `${toPlayer.userId} accepted trade from ${fromPlayer.userId}`;
      newState.phase = "END_TURN";
      break;
    }

    case "DECLINE_TRADE":
    case "CANCEL_TRADE": {
      const proposal = newState.tradeProposals.find(p => p.id === action.proposalId);
      if (proposal) {
        proposal.status = action.type === "DECLINE_TRADE" ? "DECLINED" : "CANCELLED";
        newState.lastAction = `Trade ${proposal.status.toLowerCase()}`;
      }
      if (newState.phase === "AWAITING_TRADE_RESPONSE") {
        newState.phase = "END_TURN";
      }
      break;
    }

    case "PAY_TAX": {
      currentPlayer.balance -= action.amount;
      newState.lastAction = `${currentPlayer.userId} paid ${action.amount} in taxes`;
      newState.phase = "END_TURN";
      newState.players[newState.currentPlayerIndex] = currentPlayer;
      break;
    }

    case "END_TURN": {
      /**
       * Turn / phase model:
       * - phase: 'ROLL' | 'ACTION' | 'END_TURN'
       * - currentPlayerIndex: index in players[]
       * - normal flow:
       *   - ROLL: current player rolls dice
       *   - ACTION: покупка / аренда / chance
       *   - END_TURN: переключаем currentPlayerIndex на следующего активного игрока
       * 
       * After END_TURN:
       * - Move to next ACTIVE player (skip bankrupt players)
       * - Reset phase to ROLL
       * - Clear dice roll
       * - Increment turn number
       */
      
      // Find next active player (skip bankrupt players)
      let nextIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
      let attempts = 0;
      const maxAttempts = newState.players.length;
      
      // Skip inactive players
      while (!newState.players[nextIndex].active && attempts < maxAttempts) {
        nextIndex = (nextIndex + 1) % newState.players.length;
        attempts++;
      }
      
      // If all players are inactive, keep current (shouldn't happen, but safety)
      if (!newState.players[nextIndex].active) {
        console.warn("[END_TURN] All players inactive, keeping current player");
        newState.phase = "ROLL";
        newState.diceRoll = undefined;
        break;
      }
      
      newState.currentPlayerIndex = nextIndex;
      newState.phase = "ROLL";
      newState.diceRoll = undefined;
      newState.turnNumber += 1;
      
      console.log(`[END_TURN] Turn switched: player ${newState.currentPlayerIndex} (${newState.players[nextIndex].userId}), turn ${newState.turnNumber}`);
      break;
    }
  }

  // Check for bankruptcy and mark players as inactive
  // CRITICAL: Players with balance <= 0 who cannot pay debts are marked inactive
  // This includes:
  // - Players with negative balance (from overpaying)
  // - Players with zero balance who cannot pay required amounts (already handled in rent payment)
  // Note: We check balance < 0 because balance = 0 cases are handled during action processing
  const bankruptPlayers = newState.players.filter((p) => p.active && p.balance < 0);
  if (bankruptPlayers.length > 0) {
    for (const player of bankruptPlayers) {
      const oldBalance = player.balance; // Save for logging
      player.active = false;
      player.balance = 0; // Set to 0 to prevent further negative operations
      // Transfer properties to bank (remove from player, they go back to unowned)
      // Note: In classic Monopoly, properties go to bank/auction, but for simplicity
      // we just remove ownership here
      player.properties = [];
      console.log(`[BANKRUPTCY] Player ${player.userId} (${player.id}) went bankrupt. Balance was ${oldBalance}, now set to 0.`);
    }
    newState.lastAction = `${bankruptPlayers[0].userId} went bankrupt!`;
  }

  return newState;
}

export function getTileAtPosition(boardConfig: BoardConfig, position: number): BoardTile | undefined {
  return boardConfig.tiles.find((t) => t.position === position);
}

export function calculateNetWorth(player: PlayerState, boardConfig: BoardConfig): number {
  const propertyValue = player.properties.reduce((sum, propId) => {
    const tile = boardConfig.tiles.find(t => t.id === propId);
    return sum + (tile?.price || 0);
  }, 0);
  return player.balance + propertyValue;
}

/**
 * Checks if the game should end and determines the winner.
 * 
 * Game ends when:
 * 1. Only one active player remains (all others bankrupt/inactive)
 * 2. Turn limit reached (winner = highest net worth)
 * 
 * PROTECTION: Game cannot end before:
 * - minTurnsBeforeEnd turns have passed (if set)
 * - At least 2 players have taken turns (prevents immediate end after first roll)
 * 
 * @param state Current game state
 * @param boardConfig Board configuration
 * @returns Object with ended flag, winner info, and reason
 */
export function checkGameEnd(state: GameState, boardConfig: BoardConfig): { 
  ended: boolean; 
  winnerId?: string; 
  winnerNetWorth?: number;
  reason?: string;
} {
  const activePlayers = state.players.filter(p => p.active);
  const totalPlayers = state.players.length;
  
  // DETAILED LOGGING for debugging
  console.log('[GAME END CHECK]', {
    turnNumber: state.turnNumber,
    totalPlayers,
    activePlayersCount: activePlayers.length,
    activePlayerIds: activePlayers.map(p => ({ id: p.id, userId: p.userId, balance: p.balance })),
    allPlayers: state.players.map(p => ({ id: p.id, userId: p.userId, active: p.active, balance: p.balance })),
    minTurnsBeforeEnd: state.minTurnsBeforeEnd,
    turnLimit: state.turnLimit,
  });
  
  // CRITICAL PROTECTION: Don't end game immediately after start
  // Game must have progressed at least minTurnsBeforeEnd turns
  if (state.minTurnsBeforeEnd && state.turnNumber < state.minTurnsBeforeEnd) {
    console.log('[GAME END CHECK] Blocked: turnNumber < minTurnsBeforeEnd', {
      turnNumber: state.turnNumber,
      minTurnsBeforeEnd: state.minTurnsBeforeEnd,
    });
    return { ended: false };
  }
  
  // ADDITIONAL PROTECTION: Game cannot end before all players have taken at least 1 turn
  // This prevents game from ending after first player's first roll
  // Minimum turns = number of players (each player takes 1 turn)
  const minTurnsForAllPlayers = totalPlayers;
  if (state.turnNumber < minTurnsForAllPlayers) {
    console.log('[GAME END CHECK] Blocked: not all players have taken a turn', {
      turnNumber: state.turnNumber,
      minTurnsForAllPlayers,
      totalPlayers,
    });
    return { ended: false };
  }
  
  // CRITICAL: Game cannot end if there are less than 2 active players from the start
  // This is a safety check - if somehow we have 0 or 1 active players at start, don't end
  if (activePlayers.length === 0) {
    console.error('[GAME END CHECK] ERROR: No active players! This should not happen.');
    return { ended: false };
  }
  
  // Primary condition: only one active player remains
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    const netWorth = calculateNetWorth(winner, boardConfig);
    console.log('[GAME END CHECK] Game ending: last player standing', {
      winnerId: winner.id,
      winnerUserId: winner.userId,
      netWorth,
      turnNumber: state.turnNumber,
    });
    return { 
      ended: true, 
      winnerId: winner.id,
      winnerNetWorth: netWorth,
      reason: "last_player_standing"
    };
  }
  
  // Secondary condition: turn limit reached
  if (state.turnLimit && state.turnNumber >= state.turnLimit) {
    // Find player with highest net worth
    let winner: PlayerState | null = null;
    let maxNetWorth = -Infinity;
    
    for (const player of activePlayers) {
      const netWorth = calculateNetWorth(player, boardConfig);
      if (netWorth > maxNetWorth) {
        maxNetWorth = netWorth;
        winner = player;
      }
    }
    
    if (winner) {
      console.log('[GAME END CHECK] Game ending: turn limit reached', {
        winnerId: winner.id,
        winnerUserId: winner.userId,
        netWorth: maxNetWorth,
        turnNumber: state.turnNumber,
        turnLimit: state.turnLimit,
      });
      return {
        ended: true,
        winnerId: winner.id,
        winnerNetWorth: maxNetWorth,
        reason: "turn_limit_reached"
      };
    }
  }
  
  console.log('[GAME END CHECK] Game continues', {
    turnNumber: state.turnNumber,
    activePlayersCount: activePlayers.length,
  });
  return { ended: false };
}

