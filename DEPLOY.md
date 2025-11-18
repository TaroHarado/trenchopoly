# Деплой на Vercel и GitHub

## Подготовка к деплою

### 1. Экспорт данных с локального сервера

Перед деплоем сохраните данные из локальной базы:

```bash
npm run export-data
```

Это создаст файл `prisma/seed-data.json` со всеми играми, пользователями и другими данными.

### 2. Настройка GitHub репозитория

```bash
# Инициализация git (если еще не сделано)
git init

# Добавление всех файлов
git add .

# Первый коммит
git commit -m "Initial commit"

# Создайте репозиторий на GitHub и добавьте remote
git remote add origin https://github.com/yourusername/trenchopoly.git
git branch -M main
git push -u origin main
```

### 3. Настройка Vercel

1. Зайдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Импортируйте ваш репозиторий
5. Настройте переменные окружения (см. ниже)

### 4. Переменные окружения в Vercel

В настройках проекта Vercel добавьте следующие переменные:

```
DATABASE_URL=postgresql://... (Vercel Postgres connection string)
JWT_SECRET=your-strong-random-secret-key
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
HOUSE_WALLET_PUBLIC_KEY=EzNPUsVEBtm5tr5BeWk1V1sB2q8LnWbHZkPLfqNvFarN
SOCKET_PORT=3001
```

**Важно:** Для production используйте PostgreSQL, а не SQLite!

### 5. Настройка Vercel Postgres

1. В панели Vercel перейдите в Storage
2. Создайте новую Postgres базу данных
3. Скопируйте connection string в переменную `DATABASE_URL`
4. Обновите `prisma/schema.prisma` для использования PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

5. Запустите миграции:

```bash
npx prisma migrate deploy
```

### 6. Импорт данных на production

После деплоя и настройки базы данных, импортируйте сохраненные данные:

```bash
# Установите DATABASE_URL для production
export DATABASE_URL="your-vercel-postgres-url"

# Импортируйте данные
npm run import-data
```

### 7. Настройка Socket.io на Vercel

Vercel не поддерживает WebSockets напрямую. Для Socket.io нужно использовать:

1. **Вариант 1:** Использовать отдельный сервер для Socket.io (например, Railway, Render)
2. **Вариант 2:** Использовать Vercel Serverless Functions с polling (менее оптимально)

Для production рекомендуется вынести Socket.io на отдельный сервер.

## Структура файлов для деплоя

```
├── .env.example          # Пример переменных окружения
├── .gitignore           # Игнорируемые файлы
├── vercel.json          # Конфигурация Vercel
├── package.json         # Зависимости и скрипты
├── prisma/
│   ├── schema.prisma    # Схема базы данных
│   └── seed-data.json   # Экспортированные данные (не коммитить!)
├── scripts/
│   ├── export-data.ts   # Скрипт экспорта данных
│   └── import-data.ts   # Скрипт импорта данных
└── public/
    └── logo.png         # Логотип
```

## Команды для работы с данными

```bash
# Экспорт данных из локальной базы
npm run export-data

# Импорт данных в базу
npm run import-data

# Миграция базы данных
npm run db:migrate

# Генерация Prisma клиента
npx prisma generate
```

## Проверка деплоя

После деплоя проверьте:

1. ✅ Сайт открывается на Vercel URL
2. ✅ Логотип отображается
3. ✅ Можно подключить кошелек
4. ✅ Можно создать игру
5. ✅ База данных работает (игры сохраняются)

## Troubleshooting

### Логотип не отображается
- Убедитесь, что `public/logo.png` существует
- Проверьте, что файл закоммичен в git

### База данных не работает
- Проверьте `DATABASE_URL` в переменных окружения Vercel
- Убедитесь, что миграции применены: `npx prisma migrate deploy`
- Проверьте логи в Vercel Dashboard

### Socket.io не работает
- Vercel не поддерживает WebSockets
- Используйте отдельный сервер для Socket.io или polling

