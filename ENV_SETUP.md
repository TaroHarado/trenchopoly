# Настройка .env файла для Mainnet

Создайте файл `.env` в корне проекта со следующим содержимым:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# JWT Secret (change this to a strong random string in production)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Solana Network Configuration - MAINNET
NEXT_PUBLIC_SOLANA_NETWORK="mainnet-beta"
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT="https://api.mainnet-beta.solana.com"

# House Wallet for collecting commissions
HOUSE_WALLET_PUBLIC_KEY="EzNPUsVEBtm5tr5BeWk1V1sB2q8LnWbHZkPLfqNvFarN"

# Socket.io Configuration
SOCKET_PORT=3001
```

## Важно:
- Все настройки уже переключены на **mainnet-beta** в коде
- Кошелек для комиссии: `EzNPUsVEBtm5tr5BeWk1V1sB2q8LnWbHZkPLfqNvFarN`
- Убедитесь, что ваш Phantom кошелек переключен на Mainnet перед использованием

