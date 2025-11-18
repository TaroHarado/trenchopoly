# Fix Wallet Auth Duplication, API Credentials, and Dark Mode UI

## Task Overview
Fix three critical UX issues:
1. Remove duplicate Phantom wallet button (WalletMultiButton + "Sign & Login" showing together)
2. Fix API authentication by adding `credentials: "include"` to all authenticated requests
3. Redesign entire UI to dark mode with modern 2025 aesthetics, animations, and proper game preview

---

## 1. Fix Wallet Button Duplication

### Current Problem
- `WalletAuth` component shows both `WalletMultiButton` (which already displays wallet address) AND a separate "Sign & Login" button
- This creates visual duplication and confusion

### Solution
Create a unified `components/WalletButton.tsx` that replaces `WalletAuth`:

**Requirements:**
- Single component that handles all wallet states
- If no wallet connected → Show "Connect Phantom" button
- If wallet connected but no session → Show "Phantom <shortAddress> + Sign & Login" button
- If wallet connected AND session exists → Show only "Phantom <shortAddress>" (no duplicate)
- Use dark mode styling (zinc-900, emerald accents)
- Add hover animations (scale, transitions)

**Implementation:**
```typescript
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";

function shortAddress(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

export function WalletButton() {
  const { publicKey, connect, disconnect, signMessage } = useWallet();
  
  const { data: authData, isLoading } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const handleLogin = async () => {
    if (!publicKey || !signMessage) return;
    // ... existing login logic from WalletAuth
  };

  if (isLoading) {
    return (
      <button className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 animate-pulse">
        Connecting...
      </button>
    );
  }

  if (!publicKey) {
    return (
      <button
        onClick={() => connect()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-400 text-black font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        <span className="w-6 h-6 rounded-full bg-purple-500/40" />
        Connect Phantom
      </button>
    );
  }

  if (!authData?.user) {
    return (
      <button
        onClick={handleLogin}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/80 text-zinc-100 border border-zinc-700 hover:border-emerald-400/60 hover:bg-zinc-900 transition-colors"
      >
        <span className="text-xs uppercase tracking-wide text-emerald-400">
          Phantom
        </span>
        <span className="font-mono text-sm">{shortAddress(publicKey.toBase58())}</span>
        <span className="text-xs text-zinc-400">Sign & Login</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/80 text-zinc-100 border border-zinc-700 hover:border-red-400/70 hover:bg-zinc-950 transition-colors"
    >
      <span className="text-xs uppercase tracking-wide text-emerald-400">
        Phantom
      </span>
      <span className="font-mono text-sm">{shortAddress(publicKey.toBase58())}</span>
    </button>
  );
}
```

**Replace all instances of `<WalletAuth />` with `<WalletButton />` in:**
- `components/Navbar.tsx`
- `app/lobby/page.tsx`
- `app/market/page.tsx`
- Any other pages using `WalletAuth`

---

## 2. Fix API Authentication (Missing credentials)

### Problem
All authenticated API requests are missing `credentials: "include"`, so cookies (session tokens) are not sent to the backend, causing 401 Unauthorized errors.

### Solution
Add `credentials: "include"` to ALL fetch calls that require authentication.

**Files to fix:**

1. **`components/CreateGameModal.tsx`** (line 25):
```typescript
const res = await fetch("/api/games", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({...}),
  credentials: "include", // ✅ ADD THIS
});
```

2. **`components/WalletAuth.tsx`** (lines 15, 39, 61):
```typescript
// In checkAuth:
const res = await fetch("/api/auth/me", { credentials: "include" });

// In handleLogin:
const nonceRes = await fetch("/api/auth/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
  credentials: "include", // ✅ ADD THIS
});

const verifyRes = await fetch("/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({...}),
  credentials: "include", // ✅ ADD THIS
});
```

3. **Search and fix ALL other fetch calls** that require auth:
- `app/lobby/page.tsx` - game list fetch
- `app/game/[gameId]/page.tsx` - game data fetch, ready/start endpoints
- `app/market/page.tsx` - marketplace/cases/inventory fetches
- `components/BuyInButton.tsx` - buy-in endpoints
- Any other API calls

**Pattern to search for:**
```typescript
fetch("/api/...", {
  // Add credentials: "include" if endpoint requires auth
})
```

---

## 3. Dark Mode UI Redesign

### Requirements
- **Full dark mode**: Background `bg-zinc-950` or `bg-black`, cards `bg-zinc-900/80`, borders `border-zinc-800`
- **Modern 2025 aesthetics**: Gradient accents (emerald, indigo, purple), glassmorphism effects, smooth animations
- **Animations**: Hover scale, fade-in, slide transitions, loading states
- **Proper game preview**: Visual board representation on landing page, not just placeholder

### Files to Update

#### A. Global Styles (`app/globals.css` or `tailwind.config.js`)
Add dark mode base:
```css
@layer base {
  body {
    @apply bg-zinc-950 text-zinc-100;
  }
}
```

#### B. `app/page.tsx` (Landing Page)
**Current**: Light purple/blue gradient, basic preview placeholder
**New**: 
- Dark background (`bg-zinc-950`)
- Hero section with animated gradient text
- Feature cards with glassmorphism (`bg-zinc-900/40 backdrop-blur-xl`)
- **Real game board preview**: Render actual board tiles in a visual grid (use board.json config)
- Add hover animations on cards
- Animated CTA buttons with glow effects

**Example structure:**
```tsx
<div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950">
  {/* Hero with animated gradient text */}
  <div className="container mx-auto px-4 py-16">
    <h1 className="text-6xl font-bold bg-gradient-to-r from-emerald-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent animate-pulse">
      Trendopoly
    </h1>
    
    {/* Feature cards with glassmorphism */}
    <div className="grid grid-cols-3 gap-6">
      {features.map(f => (
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-xl p-6 hover:scale-105 hover:border-emerald-400/50 transition-all">
          {/* ... */}
        </div>
      ))}
    </div>
    
    {/* REAL game board preview */}
    <GamePreviewBoard />
  </div>
</div>
```

#### C. `components/Navbar.tsx`
- Dark background (`bg-zinc-900/80 backdrop-blur-xl`)
- Light text (`text-zinc-100`)
- Hover effects on links

#### D. `app/lobby/page.tsx`
- Dark background
- Game cards with dark theme
- Animated hover states
- Loading skeletons (dark mode)

#### E. `app/game/[gameId]/page.tsx`
- Dark game board
- Player panels with dark cards
- Chat with dark theme
- Action buttons with glow effects

#### F. `app/market/page.tsx`
- Dark marketplace
- Case/item cards with dark styling
- Animated hover effects

### Animation Examples
```tsx
// Hover scale
className="hover:scale-[1.02] active:scale-[0.98] transition-transform"

// Glow effect
className="shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-shadow"

// Fade in
className="animate-in fade-in duration-500"

// Glassmorphism
className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800"
```

### Game Preview Component
Create `components/GamePreviewBoard.tsx`:
- Read board config from `config/board.json`
- Render tiles in a visual grid (circular or square layout)
- Show property colors, special tiles (GO, Jail, etc.)
- Add subtle animations (pulse on GO tile, etc.)
- Dark mode styling

---

## Implementation Order

1. **First**: Fix API credentials (add `credentials: "include"` everywhere)
2. **Second**: Replace `WalletAuth` with unified `WalletButton`
3. **Third**: Apply dark mode to all pages systematically

---

## Testing Checklist

- [ ] Wallet button shows correctly in all states (no duplication)
- [ ] Creating game works (no 401 errors)
- [ ] All pages have dark mode
- [ ] Animations work smoothly
- [ ] Game preview shows actual board layout
- [ ] All API calls include credentials

---

## Notes

- Keep existing functionality intact
- Use Tailwind CSS for all styling
- Ensure accessibility (contrast ratios, focus states)
- Test on mobile (responsive design)

