# 🔧 Устранение проблем с SSH подключениями

## Быстрая диагностика

### 1. Запустите диагностику на jump server
```bash
./scripts/ssh-diagnostic.sh jump user@home-server-ip
```

### 2. Запустите диагностику на home server
```bash
./scripts/ssh-diagnostic.sh home
```

## Частые проблемы и решения

### Проблема: "SSH на jump server не работает"

**Решение:**
```bash
# На jump server
sudo systemctl start ssh
sudo systemctl enable ssh
sudo systemctl status ssh
```

### Проблема: "Не удалось подключиться к home server"

**Решение:**
1. **Проверьте, что SSH ключ добавлен на home server:**
   ```bash
   # На jump server - покажите публичный ключ
   cat ~/.ssh/home_server_key.pub
   
   # На home server - добавьте ключ
   echo "ssh-rsa AAAAB3NzaC1yc2E..." >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

2. **Проверьте SSH сервис на home server:**
   ```bash
   # На home server
   sudo systemctl status ssh
   sudo systemctl start ssh
   ```

3. **Проверьте сетевую доступность:**
   ```bash
   # На jump server
   ping home-server-ip
   nc -zv home-server-ip 22
   ```

### Проблема: "Permission denied (publickey)"

**Решение:**
```bash
# На home server
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chmod 600 ~/.ssh/id_rsa  # если есть

# На jump server
chmod 600 ~/.ssh/home_server_key
```

### Проблема: "Host key verification failed"

**Решение:**
```bash
# На jump server
ssh-keyscan -H home-server-ip >> ~/.ssh/known_hosts

# Или добавьте вручную
echo "home-server-ip ssh-rsa AAAAB3NzaC1yc2E..." >> ~/.ssh/known_hosts
```

## Пошаговая проверка

### Шаг 1: Проверьте jump server
```bash
./scripts/ssh-diagnostic.sh jump
```

### Шаг 2: Проверьте home server
```bash
./scripts/ssh-diagnostic.sh home
```

### Шаг 3: Тестируйте подключение
```bash
# На jump server
./scripts/ssh-diagnostic.sh jump user@home-server-ip
```

### Шаг 4: Проверьте GitHub Actions
Создайте тег и запустите workflow для проверки полной цепочки.

## Команды для отладки

### Подробная диагностика SSH
```bash
# На jump server
ssh -v -i ~/.ssh/home_server_key user@home-server-ip

# Через ProxyJump
ssh -v -J user@jump-server-ip user@home-server-ip
```

### Проверка SSH конфигурации
```bash
# На jump server
sudo cat /etc/ssh/sshd_config | grep -E "(Port|PermitRootLogin|PubkeyAuthentication)"

# На home server
sudo cat /etc/ssh/sshd_config | grep -E "(Port|PermitRootLogin|PubkeyAuthentication)"
```

### Проверка логов SSH
```bash
# На jump server
sudo journalctl -u ssh -f

# На home server
sudo journalctl -u ssh -f
```

## Проверка прав доступа

### На jump server
```bash
ls -la ~/.ssh/
chmod 700 ~/.ssh
chmod 600 ~/.ssh/home_server_key
chmod 644 ~/.ssh/home_server_key.pub
```

### На home server
```bash
ls -la ~/.ssh/
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

## Создание новых SSH ключей

### Если нужно пересоздать ключи на jump server
```bash
# На jump server
rm ~/.ssh/home_server_key*
ssh-keygen -t rsa -b 4096 -f ~/.ssh/home_server_key -N ""
cat ~/.ssh/home_server_key.pub
```

### Добавление ключа на home server
```bash
# На home server
echo "ssh-rsa AAAAB3NzaC1yc2E..." >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Тестирование полной цепочки

### С локального компьютера
```bash
ssh -J user@jump-server-ip user@home-server-ip "echo 'Полная цепочка работает'"
```

### Через GitHub Actions
Создайте тег и проверьте логи workflow.

## Поддержка

Если проблема не решается:

1. Проверьте логи SSH: `sudo journalctl -u ssh -f`
2. Проверьте firewall: `sudo ufw status`
3. Проверьте сетевую доступность: `ping` и `nc`
4. Создайте Issue в репозитории с результатами диагностики
