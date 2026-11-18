# CyberMP TypeScript Template

[English](README.md) | [Русский](README.ru.md)

Full-stack TypeScript monorepo template for CyberMP gamemodes. Includes Client, Server and CEF UI with live HMR support.

---

## Требования

- [Node.js](https://nodejs.org/) (версия 18+)
- [pnpm](https://pnpm.io/) (версия 9+)

---

## Быстрый старт

### 1. Установка зависимостей

```bash
pnpm install
```

### 2. Загрузка бинарных файлов сервера CyberMP

Загружает бинарники сервера нужной версии из `package.json`:

```bash
pnpm download
# или для конкретной ОС:
pnpm download:win
pnpm download:linux
```

### 3. Сборка ресурсов

```bash
# Однократная продакшн-сборка всех ресурсов (browser -> server & client)
pnpm build

# Режим наблюдения с запуском dev-сервера для CEF UI
pnpm watch

# Режим наблюдения только для server & client (browser собирается один раз в статику)
pnpm watch:no-browser

# Сборка или watch отдельного ресурса:
node scripts/build.mjs --filter=gamemode
node scripts/build.mjs --watch --filter=gamemode
```

> **Примечание по разработке CEF:** В режиме `pnpm watch` автоматически запускается dev-сервер браузера (`pnpm run dev`) с поддержкой горячей перезагрузки (HMR). Скрипт сборки динамически подставляет локальный адрес сервера (например, `http://localhost:5173`) в `cef_url` файла `resources/<name>/resource.toml`, что позволяет мгновенно видеть изменения интерфейса. Запуск `pnpm build` возвращает `cef_url` к статическим файлам.

### 4. Запуск сервера

#### Режим разработки (с поддержкой hotreload):

```bash
# Автоопределение ОС
pnpm dev

# Или явно по платформе:
pnpm dev:win
pnpm dev:linux
```

#### Продакшн режим (без hotreload):

```bash
# Автоопределение ОС
pnpm start # или pnpm prod

# Или явно по платформе:
pnpm prod:win
pnpm prod:linux
```

#### Запуск через Docker:

```bash
# Режим разработки (с реактивным watch & hotreload через volumes)
pnpm dev:docker

# Продакшн режим
pnpm docker

# Остановка dev контейнера
pnpm docker:down
```

---

## Структура проекта

```
cybermp-typescript-template/
├── mp/              # Скачанные бинарники CyberMP (игнорируются git)
├── packages/        # Исходный код
│   └── gamemode/
│       ├── client/  # Клиентская часть (TypeScript)
│       ├── server/  # Серверная часть (TypeScript)
│       ├── shared/  # Общий код и типы (TypeScript)
│       ├── browser/ # CEF UI интерфейс (Vue 3 / Vite)
│       └── resource.toml # Манифест ресурса
├── resources/       # Ресурсы сервера CyberMP
│   ├── gamemode/    # Скомпилированный ресурс (игнорируется git)
│   └── hotreload/   # Утилита hot-reload для разработки
├── scripts/         # Скрипты сборки, загрузки и запуска сервера
└── server.toml      # Конфигурация сервера CyberMP
```

---

## Архитектура ресурсов и система сборки

Скрипт сборщика (`scripts/build.mjs`) является универсальным и поддерживает мульти-ресурсную архитектуру:

1. **Автоматическое обнаружение по `resource.toml`:**
   - Любой каталог внутри `packages/*`, содержащий файл `resource.toml`, считается отдельным ресурсом CyberMP.
   - Результат сборки помещается в `resources/<имя_пакета>/`.
   - Пакеты без файла `resource.toml` (например, общие библиотеки типов или утилит) считаются внутренними зависимостями воркспейса.

2. **Модульная структура `{server, client, browser}`:**
   - Каждый ресурс может содержать любую комбинацию из трех каталогов:
     - `server/` (точка входа: `src/index.ts`) — компилируется через esbuild в `resources/<name>/server.js`.
     - `client/` (точка входа: `src/index.ts`) — компилируется через esbuild в `resources/<name>/client.js`.
     - `browser/` — независим от бандлера и фреймворка (Vue, React, Svelte, статический HTML): вызывает скрипт сборки пакета, забирает результат из `dist/` и копирует в `resources/<name>/browser/` (а в watch-режиме запускает локальный dev-сервер с автоподменой `cef_url`).
   - Все каталоги опциональны: ресурс может быть только серверным, только клиентским, интерфейсным или полнофункциональным.

---

## Благодарности и сторонние компоненты

В проекте используются инструменты и ресурсы сообщества [CyberMP](https://github.com/Cyber-MP):

- [CyberMP Server Releases](https://github.com/Cyber-MP/CyberMP-Server-Releases) — серверные бинарные файлы.
- [CyberMP Types](https://github.com/Cyber-MP/CyberMP-Types) — TypeScript-типы для клиентской и серверной части.
- [CyberMP RPC](https://github.com/Cyber-MP/CyberMP-RPC) — библиотека Remote Procedure Call.
- [CyberMP Hotreload Resource](https://github.com/Cyber-MP/CyberMP-Hotreload-Resource) — ресурс горячей перезагрузки для разработки (включён в `resources/hotreload`).

---

## Автор

- **Nikita Kudiyarov** — [@mo3g666](https://github.com/mo3g666) — [n.kudiyarov@outlook.com](mailto:n.kudiyarov@outlook.com)

---

## Лицензия

Этот проект является открытым исходным кодом и распространяется под лицензией [MIT License](LICENSE).
