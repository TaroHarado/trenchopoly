# Trenchopoly

Online Monopoly-style game for Solana traders.

## Quick Start

1. **Clone and install:**
   ```bash
   git clone <repo-url>
   cd trenchopoly
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `JWT_SECRET` (use a strong random string)
   - `HOUSE_WALLET_PUBLIC_KEY` (your wallet address for receiving payments)
   - Other values can stay as defaults

3. **Setup database:**
   ```bash
   # For SQLite (default, no setup needed)
   npm run db:migrate
   
   # OR for PostgreSQL:
   docker-compose up -d
   # Then update DATABASE_URL in .env to: postgresql://trendopoly:trendopoly@localhost:5432/trendopoly
   npm run db:migrate
   ```

4. **Import existing data (optional):**
   ```bash
   npm run import-data
   ```
   This imports games and users from `prisma/seed-data.json`.

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Open in browser:**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Connect Phantom wallet
   - Sign message to authenticate

## Data Management

### Export data from local database:
```bash
npm run export-data
```
This creates `prisma/seed-data.json` with all games, users, and other data.

### Import data to database:
```bash
npm run import-data
```
This imports data from `prisma/seed-data.json` into the database.

## Deployment

See [DEPLOY.md](./DEPLOY.md) for detailed instructions on deploying to Vercel.

### Quick Deploy Checklist:

1. ✅ Export local data: `npm run export-data`
2. ✅ Push code to GitHub
3. ✅ Create Vercel project
4. ✅ Set environment variables in Vercel
5. ✅ Setup Vercel Postgres database
6. ✅ Run migrations: `npx prisma migrate deploy`
7. ✅ Import data: `npm run import-data`

## Testing the Full Flow

### 1. Wallet Authentication
- Open `/`
- Click "Connect Wallet" (Phantom)
- Click "Sign & Login"
- Verify you see your wallet address in navbar

### 2. Create and Join a Free Game
- Go to `/lobby`
- Click "Create Room"
- Select "Free game", set max players (2-6)
- Click "Create Room"
- You'll be redirected to `/game/[gameId]`
- Open the same URL in another browser/incognito window
- Connect a different wallet and login
- Join the game from the second window
- Both players should see each other in the players list

### 3. Start and Play
- Both players click "Ready"
- Host clicks "Start Game"
- Current player clicks "Roll Dice"
- Move token, buy properties, end turns
- Game state syncs in real-time via Socket.io

### 4. Paid Game with Buy-in
- Create a "Game with SOL buy-in" (0.1, 0.25, or 1 SOL)
- Join the game
- Click "Pay Buy-in" button
- Approve transaction in Phantom
- Buy-in is confirmed and you can start playing

### 5. Marketplace
- Go to `/market`
- Open cases to get items
- View your inventory
- List items for sale
- Buy items from other players

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── game/              # Game page
│   ├── lobby/             # Lobby page
│   └── market/            # Marketplace page
├── components/            # React components
├── config/                # Configuration files
├── lib/                   # Utility libraries
├── prisma/                # Prisma schema and migrations
├── scripts/               # Utility scripts
│   ├── export-data.ts     # Export database data
│   └── import-data.ts     # Import database data
├── server/                # Server-side code
│   ├── socket.ts          # Socket.io setup
│   └── gameEngine.ts      # Game logic
└── public/                # Static files
    └── logo.png           # Site logo
```

## Environment Variables

See `.env.example` for all required environment variables:

- `DATABASE_URL` - Database connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `NEXT_PUBLIC_SOLANA_NETWORK` - Solana network (mainnet-beta/devnet)
- `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` - Solana RPC endpoint
- `HOUSE_WALLET_PUBLIC_KEY` - Wallet address for receiving payments
- `SOCKET_PORT` - Port for Socket.io server

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Socket.io
- **Database:** Prisma ORM (SQLite for dev, PostgreSQL for production)
- **Blockchain:** Solana Web3.js, Wallet Adapter
- **Real-time:** Socket.io

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:migrate:deploy` - Deploy migrations (production)
- `npm run db:studio` - Open Prisma Studio
- `npm run export-data` - Export database data to JSON
- `npm run import-data` - Import data from JSON to database

## License

© 2025 Trenchopoly. All rights reserved.
