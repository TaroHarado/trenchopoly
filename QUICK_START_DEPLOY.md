# 🚀 Быстрый старт деплоя

## ✅ Что уже сделано:

1. ✅ Весь код загружен в GitHub: https://github.com/TaroHarado/trenchopoly
2. ✅ Данные экспортированы (16 пользователей, 34 игры) в `prisma/seed-data.json`
3. ✅ Все файлы для деплоя подготовлены

## 📋 Что нужно сделать СЕЙЧАС:

### Шаг 1: Обновите Prisma schema для PostgreSQL

**ВАЖНО:** Перед деплоем на Vercel нужно изменить базу данных с SQLite на PostgreSQL.

Откройте файл `prisma/schema.prisma` и измените строку 9:

**Было:**
```prisma
provider = "sqlite"
```

**Должно быть:**
```prisma
provider = "postgresql"
```

Затем закоммитьте и запушьте:

```bash
git add prisma/schema.prisma
git commit -m "Update schema for PostgreSQL production"
git push
```

### Шаг 2: Создайте проект в Vercel

1. Зайдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub
3. Нажмите **"Add New..."** → **"Project"**
4. Найдите `TaroHarado/trenchopoly`
5. Нажмите **"Import"**

### Шаг 3: Создайте Postgres базу данных

1. В Vercel → **Storage** → **"Create Database"**
2. Выберите **"Postgres"** → **"Hobby"** (бесплатный)
3. Скопируйте **Connection String**

### Шаг 4: Настройте переменные окружения

В Vercel → **Settings** → **Environment Variables**, добавьте:

```
DATABASE_URL=<Connection String из шага 3>
JWT_SECRET=<сгенерируйте: openssl rand -base64 32>
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
HOUSE_WALLET_PUBLIC_KEY=EzNPUsVEBtm5tr5BeWk1V1sB2q8LnWbHZkPLfqNvFarN
SOCKET_PORT=3001
```

### Шаг 5: Настройте Build Command

В настройках проекта Vercel → **Settings** → **General** → **Build & Development Settings**:

**Build Command:**
```
prisma generate && prisma migrate deploy && next build
```

### Шаг 6: Деплой

Нажмите **"Deploy"** и дождитесь завершения (2-5 минут).

### Шаг 7: Импорт данных

После успешного деплоя:

```bash
# Установите Vercel CLI
npm i -g vercel

# Войдите
vercel login

# Подключитесь к проекту
vercel link

# Скачайте переменные окружения
vercel env pull .env.local

# Импортируйте данные
npm run import-data
```

## 📖 Подробные инструкции

См. [VERCEL_SETUP.md](./VERCEL_SETUP.md) для детальных инструкций.

## ⚠️ Важно

- Socket.io не работает на Vercel напрямую (нужен отдельный сервер или polling)
- Для production используйте PostgreSQL, не SQLite
- Не забудьте импортировать данные после деплоя!

## 🎉 Готово!

После выполнения всех шагов ваш сайт будет доступен на `trenchopoly.vercel.app` (или ваш кастомный домен).

