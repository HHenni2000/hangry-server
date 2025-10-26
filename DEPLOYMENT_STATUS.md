# Deployment Status - Stand 25.10.2025 21:15 Uhr

## ✅ Erfolgreich abgeschlossen:

### Phase 1: Backups
- [x] PM2 Backup erstellt: `~/backups/2025-10-25/dump.pm2.backup`
- [x] Caddy Config Backup: `~/backups/2025-10-25/Caddyfile.backup`

### Phase 2: Server Upload
- [x] Code nach `~/hangry-server` hochgeladen
- [x] Dependencies installiert (92 packages, 0 vulnerabilities)
- [x] `.env` Datei erstellt (PORT=3002)

### Phase 3: PM2 Setup
- [x] hangry-server mit PM2 gestartet
- [x] Beide Server laufen parallel:
  - braindump-server (ID 0) - Port 3000 ✅
  - hangry-server (ID 1) - Port 3002 ✅
- [x] PM2 Autostart gespeichert

### Phase 4: Caddy Konfiguration
- [x] Caddyfile erweitert mit hangry.kotoro.de Subdomain
- [x] Config validiert und Caddy neu geladen
- [x] Lokale Tests erfolgreich:
  - `http://localhost:3000` → braindump ✅
  - `https://kotoro.de` → braindump ✅
  - `http://localhost:3002` → hangry ✅

### Phase 5: DNS Konfiguration
- [x] Server IP ermittelt: `72.60.80.95` (IPv4)
- [x] DNS A-Record bei Hostinger erstellt:
  - Name: `hangry`
  - Value: `72.60.80.95`
  - TTL: 3600

---

## 📋 Nächste Schritte (Morgen):

### 1. DNS Propagation prüfen (5-10 Min)
**Auf deinem Windows PC:**
```powershell
nslookup hangry.kotoro.de
```
Erwartete Ausgabe: `Address: 72.60.80.95`

### 2. SSL-Zertifikat prüfen
**Im SSH-Terminal:**
```bash
# Caddy Logs anschauen (Caddy holt automatisch SSL-Zertifikat)
journalctl -u caddy -n 50 | grep -i certificate

# Oder live beobachten:
journalctl -u caddy -f
```

### 3. Hangry via HTTPS testen
**Im SSH-Terminal:**
```bash
curl https://hangry.kotoro.de
```
Erwartete Antwort: `{"ok":true,"service":"shopping-list-server",...}`

### 4. Finale Tests
```bash
# Beide Server müssen funktionieren:
curl https://kotoro.de              # braindump
curl https://hangry.kotoro.de       # hangry

# PM2 Status prüfen:
pm2 list
```

### 5. Mobile App für Produktion konfigurieren
**Datei editieren:** `hangry-mobile/src/config/api.ts`
```typescript
const IS_PRODUCTION = true;  // ← Auf true ändern

export const API_CONFIG = {
  BASE_URL: IS_PRODUCTION
    ? 'https://hangry.kotoro.de'  // Production
    : 'http://192.168.178.58:3002',
};
```

### 6. Mobile App testen
```bash
cd hangry-mobile
npm start
```
- App öffnen
- Item hinzufügen/abhaken
- Sync testen

---

## 🛡️ Wichtig:

- **Braindump läuft weiter:** Nicht berührt, funktioniert normal ✅
- **Beide Server parallel:** Port 3000 (braindump) + Port 3002 (hangry)
- **Backups vorhanden:** Falls Rollback nötig

## 🔧 Nützliche Befehle:

```bash
# SSH verbinden
ssh root@kotoro.de

# Server Status
pm2 list
pm2 logs hangry-server

# Tests
curl https://kotoro.de              # braindump
curl https://hangry.kotoro.de       # hangry
curl http://localhost:3000          # braindump lokal
curl http://localhost:3002          # hangry lokal

# Caddy
systemctl status caddy
journalctl -u caddy -n 50
```

## 📞 Bei Problemen:

### Rollback (falls nötig)
```bash
# Hangry stoppen
pm2 stop hangry-server
pm2 delete hangry-server

# Caddy Config zurücksetzen
cp ~/backups/2025-10-25/Caddyfile.backup /etc/caddy/Caddyfile
systemctl reload caddy

# PM2 wiederherstellen
pm2 resurrect ~/backups/2025-10-25/dump.pm2.backup
```

---

**Status:** Bereit für finale Tests morgen! 🚀
**Geschätzte Zeit bis fertig:** 10-15 Minuten
