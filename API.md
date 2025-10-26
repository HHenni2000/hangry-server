# Hangry Shopping List - API Documentation

## 📋 Übersicht

Die Hangry Shopping List API bietet zwei Kategorien von Endpoints:

1. **External API** - Für Integrationen mit anderen Apps (z.B. Braindump) - **Benötigt API-Key**
2. **Internal API** - Für die Hangry Mobile App - **Kein API-Key erforderlich**

## 🔐 Authentifizierung (nur External API)

Externe Endpoints benötigen einen API-Key zur Authentifizierung.

### API-Key übermitteln

**Option 1: Header (empfohlen)**
```http
X-API-Key: your-secret-api-key-here
```

**Option 2: Query Parameter**
```http
?apiKey=your-secret-api-key-here
```

### API-Key einrichten

1. Server: `.env` Datei erstellen:
   ```bash
   API_KEY=dein-geheimer-schluessel
   ```

2. Starken Key generieren:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

---

## 🌐 Base URLs

- **Development:** `http://localhost:3002`
- **Production:** `https://hangry.kotoro.de`

---

## 📡 External API Endpoints (mit API-Key)

### 1. Single Item hinzufügen

Fügt ein einzelnes Produkt zur Shopping-Liste hinzu.

**Endpoint:** `POST /api/external/add-item`

**Headers:**
```http
Content-Type: application/json
X-API-Key: your-secret-api-key-here
```

**Request Body:**
```json
{
  "name": "Milch",           // REQUIRED - Produktname
  "categoryId": "dairy-cheese", // OPTIONAL - Kategorie-ID (auto-detect wenn nicht angegeben)
  "quantity": "2L"           // OPTIONAL - Menge/Anzahl
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Successfully added 1 item(s)",
  "data": {
    "addedItems": [
      {
        "id": "1730000000000-abc123",
        "name": "Milch",
        "categoryId": "dairy-cheese",
        "quantity": "2L",
        "checked": false,
        "createdAt": "2025-10-26T14:30:00.000Z",
        "checkedAt": null
      }
    ],
    "totalItems": 12
  }
}
```

**Response (Error - Unauthorized):**
```json
{
  "success": false,
  "error": "Unauthorized - Invalid or missing API key"
}
```

**cURL Beispiel:**
```bash
curl -X POST https://hangry.kotoro.de/api/external/add-item \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{
    "name": "Milch",
    "quantity": "2L"
  }'
```

---

### 2. Mehrere Items hinzufügen (Batch)

Fügt mehrere Produkte gleichzeitig hinzu.

**Endpoint:** `POST /api/external/add-item`

**Request Body:**
```json
{
  "items": [
    {
      "name": "Milch",
      "quantity": "2L"
    },
    {
      "name": "Brot",
      "categoryId": "bakery"
    },
    {
      "name": "Eier",
      "quantity": "10 Stück"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully added 3 item(s)",
  "data": {
    "addedItems": [
      {
        "id": "1730000000000-abc123",
        "name": "Milch",
        "categoryId": "dairy-cheese",
        "quantity": "2L",
        "checked": false,
        "createdAt": "2025-10-26T14:30:00.000Z"
      },
      {
        "id": "1730000000001-def456",
        "name": "Brot",
        "categoryId": "bakery",
        "checked": false,
        "createdAt": "2025-10-26T14:30:01.000Z"
      },
      {
        "id": "1730000000002-ghi789",
        "name": "Eier",
        "categoryId": "pantry",
        "quantity": "10 Stück",
        "checked": false,
        "createdAt": "2025-10-26T14:30:02.000Z"
      }
    ],
    "totalItems": 15
  }
}
```

**cURL Beispiel:**
```bash
curl -X POST https://hangry.kotoro.de/api/external/add-item \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{
    "items": [
      {"name": "Milch", "quantity": "2L"},
      {"name": "Brot"},
      {"name": "Eier", "quantity": "10 Stück"}
    ]
  }'
```

---

## 🏷️ Kategorie-IDs

Die API erkennt automatisch die Kategorie basierend auf Keywords. Du kannst aber auch manuell eine `categoryId` angeben:

| Category ID | Name (Deutsch) | Beispiele |
|-------------|---------------|-----------|
| `fruits-vegetables` | Obst & Gemüse | Äpfel, Tomaten, Salat, Gurken |
| `dairy-cheese` | Milchprodukte | Milch, Käse, Butter, Joghurt |
| `meat-fish` | Fleisch & Fisch | Hähnchen, Lachs, Wurst |
| `bakery` | Brot & Backwaren | Brot, Brötchen, Croissant |
| `pantry` | Vorratskammer | Reis, Nudeln, Mehl, Eier |
| `frozen` | Tiefkühlprodukte | Pizza, Pommes, TK-Gemüse |
| `beverages` | Getränke | Wasser, Saft, Bier |
| `snacks` | Snacks & Süßigkeiten | Chips, Schokolade, Kekse |
| `household` | Haushalt | Spülmittel, Müllbeutel |
| `personal-care` | Körperpflege | Shampoo, Zahnpasta, Seife |
| `other` | Sonstiges | Alles andere |

**Automatische Kategorisierung:**
- "Milch" → `dairy-cheese`
- "Tomaten" → `fruits-vegetables`
- "Brot" → `bakery`
- "Shampoo" → `personal-care`

---

## 📱 Internal API Endpoints (für Mobile App)

Diese Endpoints werden von der Hangry Mobile App genutzt und benötigen **keinen API-Key**.

### GET /api/shopping/list
Gibt die komplette Shopping-Liste zurück.

### POST /api/shopping/items
Fügt ein neues Item hinzu (für Mobile App).

### PATCH /api/shopping/items/:id
Aktualisiert ein Item (z.B. abhaken).

### DELETE /api/shopping/items/:id
Löscht ein Item.

### DELETE /api/shopping/items
Löscht alle abgehakten Items.

---

## 🔗 Integration Beispiele

### JavaScript / Node.js

```javascript
const axios = require('axios');

const API_URL = 'https://hangry.kotoro.de';
const API_KEY = 'your-secret-api-key-here';

// Single Item
async function addItem(name, quantity = null) {
  try {
    const response = await axios.post(
      `${API_URL}/api/external/add-item`,
      { name, quantity },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        }
      }
    );
    console.log('Item added:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Multiple Items
async function addItems(items) {
  try {
    const response = await axios.post(
      `${API_URL}/api/external/add-item`,
      { items },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        }
      }
    );
    console.log('Items added:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Verwendung
addItem('Milch', '2L');
addItems([
  { name: 'Brot' },
  { name: 'Eier', quantity: '10 Stück' },
  { name: 'Tomaten', categoryId: 'fruits-vegetables' }
]);
```

### Python

```python
import requests

API_URL = 'https://hangry.kotoro.de'
API_KEY = 'your-secret-api-key-here'

def add_item(name, quantity=None):
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    }
    payload = {'name': name}
    if quantity:
        payload['quantity'] = quantity

    response = requests.post(
        f'{API_URL}/api/external/add-item',
        json=payload,
        headers=headers
    )
    return response.json()

def add_items(items):
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    }
    response = requests.post(
        f'{API_URL}/api/external/add-item',
        json={'items': items},
        headers=headers
    )
    return response.json()

# Verwendung
add_item('Milch', '2L')
add_items([
    {'name': 'Brot'},
    {'name': 'Eier', 'quantity': '10 Stück'}
])
```

### Braindump Integration (Beispiel)

```javascript
// In deinem Braindump-Projekt
async function sendToShoppingList(text) {
  // Parse Text (z.B. "Einkaufen: Milch, Brot, Eier")
  const items = parseShoppingItems(text);

  const response = await fetch('https://hangry.kotoro.de/api/external/add-item', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.HANGRY_API_KEY
    },
    body: JSON.stringify({ items })
  });

  return response.json();
}

function parseShoppingItems(text) {
  // Beispiel: "Milch 2L, Brot, Eier 10 Stück"
  const parts = text.split(',');
  return parts.map(part => {
    const trimmed = part.trim();
    // Einfaches Parsing - kann erweitert werden
    return { name: trimmed };
  });
}
```

---

## 🚀 WebSocket Real-time Updates

Wenn Items über die External API hinzugefügt werden, erhalten alle verbundenen Mobile Clients **automatisch** eine Echtzeit-Aktualisierung über WebSocket.

**Event:** `list-updated`

Keine zusätzliche Implementierung im Braindump-Projekt nötig - die Mobile App wird automatisch benachrichtigt.

---

## ❌ Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized - Invalid or missing API key"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Either \"name\" or \"items\" array is required"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Error message details"
}
```

---

## 🧪 Testing

### Lokaler Test (Development)

```bash
# Server starten
cd hangry-server
npm run dev

# Test Endpoint (in neuem Terminal)
curl -X POST http://localhost:3002/api/external/add-item \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{"name": "Test Item"}'
```

### Production Test

```bash
curl -X POST https://hangry.kotoro.de/api/external/add-item \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-actual-production-key" \
  -d '{"name": "Milch", "quantity": "2L"}'
```

---

## 🔒 Sicherheit

1. **API-Key sicher aufbewahren**
   - Nie im Git-Repository committen
   - In `.env` Datei speichern
   - Für Production einen starken, zufälligen Key generieren

2. **HTTPS verwenden**
   - Production API läuft über HTTPS (Caddy SSL)
   - Keine unverschlüsselte Übertragung des API-Keys

3. **Rate Limiting** (empfohlen für Production)
   - Aktuell nicht implementiert
   - Kann mit `express-rate-limit` hinzugefügt werden

---

## 📞 Support

Bei Fragen oder Problemen:
- API Logs: `pm2 logs hangry-server`
- Server Status: `pm2 list`
- Test Health: `curl https://hangry.kotoro.de`
