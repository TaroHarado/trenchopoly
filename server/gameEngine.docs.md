# Game Engine Documentation

## Game Model Overview

### Game Statuses (Database Level)
- `WAITING`: Game is in lobby, waiting for players to join and ready up
- `IN_PROGRESS`: Game has started, players are taking turns
- `FINISHED`: Game has ended, winner determined

### Game State Structure (`GameState`)
```typescript
{
  currentPlayerIndex: number;        // Index of player whose turn it is
  players: PlayerState[];            // Array of all players
  diceRoll?: [number, number];       // Current dice roll result
  lastAction?: string;               // Description of last action
  phase: "ROLL" | "ACTION" | "END_TURN" | "AWAITING_TRADE_RESPONSE";
  turnNumber: number;                // Current turn number (starts at 1)
  gameEnded?: boolean;               // True if game has ended
  winnerId?: string;                 // ID of winning player
  winnerNetWorth?: number;           // Winner's final net worth
  turnLimit?: number;                // Maximum turns (default: 100)
  gameJustStarted?: boolean;          // True if game just started
  minTurnsBeforeEnd?: number;        // Minimum turns before game can end
  // ... other fields
}
```

### Player State Structure (`PlayerState`)
```typescript
{
  id: string;                         // Unique player ID
  userId: string;                    // User ID (can be bot userId)
  position: number;                  // Current board position (0-39)
  balance: number;                   // Current cash balance
  properties: string[];               // Array of owned tile IDs
  inJail: boolean;                   // True if player is in jail
  jailTurns: number;                 // Number of turns in jail
  active: boolean;                    // False if player is bankrupt
  getOutOfJailCards: number;          // Number of "Get Out of Jail Free" cards
}
```

## Game Flow

### Turn Phases
1. **ROLL**: Player must roll dice
   - Action: `ROLL_DICE`
   - After roll: player moves, phase changes to `ACTION` or `END_TURN`

2. **ACTION**: Player can perform actions based on landed tile
   - Actions: `BUY_PROPERTY`, `SKIP_BUY`, `PAY_RENT`, `PAY_TAX`, `DRAW_CARD`, etc.
   - After action: phase changes to `END_TURN`

3. **END_TURN**: Player must end their turn
   - Action: `END_TURN`
   - After end: `currentPlayerIndex` increments, `turnNumber` increments, phase resets to `ROLL`

### Actions
- `ROLL_DICE`: Roll two dice, move player, handle tile landing
- `BUY_PROPERTY`: Purchase unowned property
- `SKIP_BUY`: Skip purchasing property
- `PAY_RENT`: Pay rent to property owner
- `PAY_TAX`: Pay tax on tax tile
- `DRAW_CARD`: Draw a chance/community chest card
- `RESOLVE_CARD`: Resolve drawn card effect
- `END_TURN`: End current turn, move to next player
- `DECLARE_BANKRUPTCY`: Player declares bankruptcy (sets `active = false`)

## Game End Conditions

### Current Implementation (`checkGameEnd`)

**Game ends when:**

1. **Only one active player remains** (`activePlayers.length === 1`)
   - Winner: The remaining active player
   - Reason: `"last_player_standing"`
   - **PROBLEM**: This can trigger immediately if:
     - Only one player is active from the start (initialization bug)
     - One player becomes inactive after first roll (bankruptcy bug)

2. **Turn limit reached** (`turnNumber >= turnLimit`)
   - Winner: Player with highest net worth
   - Reason: `"turn_limit_reached"`
   - Net worth = balance + sum of property values

**Protection against premature end:**
- `minTurnsBeforeEnd`: If set, game cannot end before this many turns
- Currently set to `2` for single-player + bot games

### Bankruptcy Handling

**Current behavior:**
- In `applyAction`, after any action, checks for players with `balance < 0`
- If found, logs message but **DOES NOT set `active = false`**
- Only `DECLARE_BANKRUPTCY` action sets `active = false`

**PROBLEM**: Players with negative balance are still considered active, which can cause:
- Game to not end when it should (if all but one are bankrupt but still active)
- Game to end prematurely (if checkGameEnd incorrectly counts active players)

## Known Issues

1. **Bankruptcy not properly handled**: Players with negative balance are not marked inactive
2. **Game can end after first roll**: If `activePlayers.length === 1` after first action
3. **minTurnsBeforeEnd may not be sufficient**: If one player becomes inactive immediately

## Recommended Fixes

1. **Fix bankruptcy handling**: Set `active = false` when `balance < 0` and player cannot pay debts
2. **Add minimum active players check**: Game should require at least 2 active players to continue
3. **Improve logging**: Add detailed logs in `checkGameEnd` to track why game ends
4. **Add turn-based protection**: Game cannot end before all players have taken at least N turns

