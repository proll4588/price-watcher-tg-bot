#!/bin/bash

# Скрипт для исправления SSH ключей между jump server и home server
# Использование: ./scripts/fix-ssh-keys.sh [jump|home] [user@ip]

set -e

echo "🔧 SSH Keys Fix Tool"
echo "===================="

case "$1" in
    "jump")
        echo "🔧 Исправление на Jump Server"
        echo "============================="
        
        if [ -z "$2" ]; then
            echo "❌ Укажите пользователя и IP home server"
            echo "Использование: $0 jump user@home-server-ip"
            exit 1
        fi
        
        echo "1️⃣ Проверяем SSH ключ для home server..."
        if [ ! -f ~/.ssh/home_server_key ]; then
            echo "❌ SSH ключ не найден, создаем новый..."
            ssh-keygen -t rsa -b 4096 -f ~/.ssh/home_server_key -N ""
        fi
        
        echo "2️⃣ Устанавливаем правильные права..."
        chmod 700 ~/.ssh
        chmod 600 ~/.ssh/home_server_key
        chmod 644 ~/.ssh/home_server_key.pub
        
        echo "3️⃣ Показываем публичный ключ для добавления на home server:"
        echo "=========================================="
        cat ~/.ssh/home_server_key.pub
        echo "=========================================="
        echo ""
        echo "📝 Скопируйте этот ключ и добавьте его в ~/.ssh/authorized_keys на home server"
        echo "Или выполните на home server:"
        echo "  echo \"$(cat ~/.ssh/home_server_key.pub)\" >> ~/.ssh/authorized_keys"
        
        echo ""
        echo "4️⃣ Тестируем подключение..."
        ssh -T -o ConnectTimeout=10 -o BatchMode=yes -i ~/.ssh/home_server_key "$2" "echo 'Подключение работает!'" 2>/dev/null || {
            echo "❌ Подключение не работает"
            echo "Добавьте публичный ключ на home server и попробуйте снова"
        }
        
        ;;
        
    "home")
        echo "🏠 Исправление на Home Server"
        echo "============================="
        
        echo "1️⃣ Проверяем authorized_keys..."
        if [ ! -f ~/.ssh/authorized_keys ]; then
            echo "❌ authorized_keys не найден, создаем..."
            touch ~/.ssh/authorized_keys
        fi
        
        echo "2️⃣ Устанавливаем правильные права..."
        chmod 700 ~/.ssh
        chmod 600 ~/.ssh/authorized_keys
        
        echo "3️⃣ Показываем текущие ключи:"
        echo "=========================================="
        cat ~/.ssh/authorized_keys
        echo "=========================================="
        
        echo ""
        echo "4️⃣ Для добавления нового ключа jump server:"
        echo "   - Скопируйте публичный ключ с jump server"
        echo "   - Выполните: echo 'ssh-rsa...' >> ~/.ssh/authorized_keys"
        echo "   - Или используйте: $0 home add [ssh-rsa...]"
        
        if [ "$2" = "add" ] && [ -n "$3" ]; then
            echo ""
            echo "5️⃣ Добавляем ключ..."
            echo "$3" >> ~/.ssh/authorized_keys
            chmod 600 ~/.ssh/authorized_keys
            echo "✅ Ключ добавлен"
        fi
        
        ;;
        
    *)
        echo "❌ Неверный аргумент"
        echo "Использование: $0 [jump|home] [user@ip|add ssh-rsa...]"
        echo ""
        echo "Примеры:"
        echo "  $0 jump user@home-server-ip  - исправление на jump server"
        echo "  $0 home                     - проверка на home server"
        echo "  $0 home add ssh-rsa...      - добавление ключа на home server"
        exit 1
        ;;
esac

echo ""
echo "✅ Операция завершена"
