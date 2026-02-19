#!/bin/bash

echo "🚀 Запуск XimFinance..."
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен${NC}"
    echo "Пожалуйста, установите Node.js 18 или выше"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Проверка PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL не найден${NC}"
    echo "Пожалуйста, установите PostgreSQL или используйте Docker"
    echo ""
    read -p "Продолжить? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Проверка зависимостей
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}📦 Установка зависимостей backend...${NC}"
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 Установка зависимостей frontend...${NC}"
    cd frontend && npm install && cd ..
fi

# Проверка .env файлов
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚙️  Создание backend/.env из примера...${NC}"
    cp backend/.env.example backend/.env
fi

if [ ! -f "frontend/.env" ]; then
    echo -e "${YELLOW}⚙️  Создание frontend/.env из примера...${NC}"
    cp frontend/.env.example frontend/.env
fi

echo ""
echo -e "${GREEN}✅ Проверка завершена${NC}"
echo ""
echo "Запуск серверов..."
echo ""
echo -e "${YELLOW}Backend:${NC} http://localhost:3001"
echo -e "${YELLOW}Frontend:${NC} http://localhost:5173"
echo ""

# Создание функции trap для очистки при завершении
cleanup() {
    echo ""
    echo "🛑 Остановка серверов..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Запуск backend
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}✓ Backend запущен (PID: $BACKEND_PID)${NC}"

# Запуск frontend
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}✓ Frontend запущен (PID: $FRONTEND_PID)${NC}"
echo ""
echo -e "${GREEN}🎉 Приложение готово!${NC}"
echo ""
echo "Откройте в браузере: http://localhost:5173"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Ожидание завершения
wait
