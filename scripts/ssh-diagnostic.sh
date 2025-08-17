#!/bin/bash

# Скрипт для диагностики SSH подключений
# Использование: ./scripts/ssh-diagnostic.sh [jump|home]

set -e

echo "🔍 SSH Diagnostic Tool"
echo "======================"

case "$1" in
    "jump")
        echo "🔧 Диагностика на Jump Server"
        echo "============================="
        
        echo "1️⃣ Проверяем SSH директорию..."
        ls -la ~/.ssh/
        
        echo ""
        echo "2️⃣ Проверяем SSH ключи..."
        if [ -f ~/.ssh/home_server_key ]; then
            echo "✅ SSH ключ для home server найден"
            ls -la ~/.ssh/home_server_key*
        else
            echo "❌ SSH ключ для home server НЕ найден"
            echo "Создайте ключ: ssh-keygen -t rsa -b 4096 -f ~/.ssh/home_server_key -N ''"
        fi
        
        echo ""
        echo "3️⃣ Проверяем authorized_keys..."
        if [ -f ~/.ssh/authorized_keys ]; then
            echo "✅ authorized_keys найден"
            echo "Количество ключей: $(wc -l < ~/.ssh/authorized_keys)"
        else
            echo "❌ authorized_keys НЕ найден"
        fi
        
        echo ""
        echo "4️⃣ Проверяем права доступа..."
        chmod 700 ~/.ssh 2>/dev/null || echo "Не удалось изменить права на .ssh"
        chmod 600 ~/.ssh/home_server_key 2>/dev/null || echo "Не удалось изменить права на ключ"
        chmod 644 ~/.ssh/home_server_key.pub 2>/dev/null || echo "Не удалось изменить права на публичный ключ"
        
        echo ""
        echo "5️⃣ Тестируем SSH конфигурацию..."
        ssh -T -o ConnectTimeout=5 -o BatchMode=yes localhost "echo 'SSH на jump server работает'" 2>/dev/null || echo "SSH на jump server не работает"
        
        ;;
        
    "home")
        echo "🏠 Диагностика на Home Server"
        echo "============================="
        
        echo "1️⃣ Проверяем SSH директорию..."
        ls -la ~/.ssh/
        
        echo ""
        echo "2️⃣ Проверяем authorized_keys..."
        if [ -f ~/.ssh/authorized_keys ]; then
            echo "✅ authorized_keys найден"
            echo "Содержимое:"
            cat ~/.ssh/authorized_keys
        else
            echo "❌ authorized_keys НЕ найден"
        fi
        
        echo ""
        echo "3️⃣ Проверяем права доступа..."
        chmod 700 ~/.ssh 2>/dev/null || echo "Не удалось изменить права на .ssh"
        chmod 600 ~/.ssh/authorized_keys 2>/dev/null || echo "Не удалось изменить права на authorized_keys"
        
        echo ""
        echo "4️⃣ Проверяем SSH сервис..."
        sudo systemctl status ssh --no-pager -l || echo "SSH сервис не найден"
        
        echo ""
        echo "5️⃣ Проверяем SSH конфигурацию..."
        ssh -T -o ConnectTimeout=5 -o BatchMode=yes localhost "echo 'SSH на home server работает'" 2>/dev/null || echo "SSH на home server не работает"
        
        ;;
        
    *)
        echo "❌ Неверный аргумент"
        echo "Использование: $0 [jump|home]"
        echo ""
        echo "Примеры:"
        echo "  $0 jump  - диагностика на jump server"
        echo "  $0 home  - диагностика на home server"
        exit 1
        ;;
esac

echo ""
echo "✅ Диагностика завершена"
