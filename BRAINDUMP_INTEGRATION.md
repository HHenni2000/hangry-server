# Hangry ↔ Braindump Integration

## 🎯 Übersicht

Diese Anleitung zeigt, wie du aus deinem Braindump-Projekt Items direkt zur Hangry Shopping-Liste hinzufügen kannst.

---

## 🔑 API-Key

**Production API-Key:**
```
3475bd78517cc08462ef7062b9360d3c91a6182f01c9514bd48c5e88b7ce2a14
```

⚠️ **WICHTIG:** Diesen Key niemals in Git committen! In `.env` Datei speichern.

---

## 📡 API Endpoint

**URL:** `https://hangry.kotoro.de/api/external/add-item`

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
X-API-Key: 3475bd78517cc08462ef7062b9360d3c91a6182f01c9514bd48c5e88b7ce2a14
```

---

## 💻 Integration Code (Node.js / TypeScript)

### Einfache Funktion

```typescript
// braindump-server/src/services/hangryService.ts

const HANGRY_API_URL = 'https://hangry.kotoro.de';
const HANGRY_API_KEY = process.env.HANGRY_API_KEY; // In .env speichern!

interface HangryItem {
  name: string;
  quantity?: string;
  categoryId?: string;
}

export async function addToShoppingList(
  item: string | HangryItem | HangryItem[]
): Promise<void> {
  try {
    let payload: { name?: string; items?: HangryItem[] };

    // Handle different input types
    if (typeof item === 'string') {
      payload = { name: item };
    } else if (Array.isArray(item)) {
      payload = { items: item };
    } else {
      payload = { name: item.name };
      if (item.quantity) payload['quantity'] = item.quantity;
      if (item.categoryId) payload['categoryId'] = item.categoryId;
    }

    const response = await fetch(`${HANGRY_API_URL}/api/external/add-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HANGRY_API_KEY!,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log(`✅ Added ${result.message} to shopping list`);
    return result.data;
  } catch (error) {
    console.error('❌ Failed to add to shopping list:', error);
    throw error;
  }
}

// Verwendung:
// await addToShoppingList('Milch');
// await addToShoppingList({ name: 'Brot', quantity: '2 Stück' });
// await addToShoppingList([
//   { name: 'Milch', quantity: '2L' },
//   { name: 'Eier', quantity: '10 Stück' }
// ]);
```

---

## 🎨 Use-Cases für Braindump

### 1. Text Parsing: "Einkaufen: ..."

```typescript
// Beispiel: User schreibt "Einkaufen: Milch, Brot, Eier"

export function parseShoppingListFromText(text: string): HangryItem[] {
  // Check if text starts with "Einkaufen:" or similar
  const match = text.match(/^einkauf(?:en)?:\s*(.+)$/i);
  if (!match) return [];

  // Split by comma and parse
  const itemsText = match[1];
  return itemsText
    .split(',')
    .map(item => {
      const trimmed = item.trim();

      // Parse quantity: "Milch 2L" → { name: "Milch", quantity: "2L" }
      const quantityMatch = trimmed.match(/^(.+?)\s+(\d+\s*\w+)$/);
      if (quantityMatch) {
        return {
          name: quantityMatch[1].trim(),
          quantity: quantityMatch[2].trim()
        };
      }

      return { name: trimmed };
    })
    .filter(item => item.name.length > 0);
}

// Verwendung in Braindump Note-Handler:
async function handleNoteCreate(noteText: string) {
  const items = parseShoppingListFromText(noteText);

  if (items.length > 0) {
    await addToShoppingList(items);
    // Optional: Notiz als "processed" markieren oder löschen
  }
}
```

### 2. Slash Command Integration

```typescript
// In deinem Braindump Command Handler

async function handleCommand(command: string, args: string[]) {
  if (command === '/shop' || command === '/einkaufen') {
    const itemName = args.join(' ');

    if (!itemName) {
      return 'Usage: /shop <item name> [quantity]';
    }

    try {
      await addToShoppingList(itemName);
      return `✅ "${itemName}" zur Einkaufsliste hinzugefügt!`;
    } catch (error) {
      return `❌ Fehler beim Hinzufügen: ${error.message}`;
    }
  }
}

// User schreibt: "/shop Milch 2L"
// → "Milch 2L" wird zur Shopping-Liste hinzugefügt
```

### 3. Tag-basierte Erkennung

```typescript
// Automatisch Items mit #einkaufen Tag zur Liste hinzufügen

async function processNoteWithTags(note: Note) {
  if (note.tags.includes('einkaufen') || note.tags.includes('shopping')) {
    // Parse note content for items
    const lines = note.content.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'));

    const items = lines.map(line => {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      return { name: cleaned };
    });

    if (items.length > 0) {
      await addToShoppingList(items);
      console.log(`Added ${items.length} items from note "${note.title}"`);
    }
  }
}

// Beispiel Note:
// Title: "Einkaufen für die Woche"
// Tags: #einkaufen
// Content:
//   - Milch 2L
//   - Brot
//   - Eier 10 Stück
//   - Tomaten
```

### 4. Voice/Natural Language Processing

```typescript
// Wenn Braindump Speech-to-Text oder NLP hat

async function handleVoiceCommand(transcription: string) {
  // "Füge Milch zur Einkaufsliste hinzu"
  // "Ich brauche Brot und Eier"
  // "Schreib Tomaten auf die Liste"

  const patterns = [
    /(?:füge|add|schreib)\s+(.+?)\s+(?:zur einkaufsliste|auf die liste)/i,
    /ich brauche\s+(.+)/i,
    /einkaufen:\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = transcription.match(pattern);
    if (match) {
      const itemsText = match[1];
      const items = itemsText.split(/\s+und\s+|,\s*/)
        .map(item => ({ name: item.trim() }));

      await addToShoppingList(items);
      return `✅ ${items.length} Item(s) hinzugefügt`;
    }
  }
}
```

---

## 🔧 Setup in Braindump

### 1. Environment Variable hinzufügen

```bash
# braindump-server/.env

HANGRY_API_KEY=3475bd78517cc08462ef7062b9360d3c91a6182f01c9514bd48c5e88b7ce2a14
```

### 2. Service erstellen

```bash
# Im braindump-server Projekt

mkdir -p src/services
touch src/services/hangryService.ts

# Code aus oben einfügen
```

### 3. In bestehende Features integrieren

```typescript
// Beispiel: In deinem Note-Handler

import { addToShoppingList, parseShoppingListFromText } from './services/hangryService';

// Bei Note-Erstellung/Update
router.post('/api/notes', async (req, res) => {
  const note = req.body;

  // ... normale Note-Logik ...

  // Check for shopping list items
  const items = parseShoppingListFromText(note.content);
  if (items.length > 0) {
    try {
      await addToShoppingList(items);
      // Optional: User benachrichtigen
    } catch (error) {
      console.error('Failed to sync to Hangry:', error);
    }
  }

  res.json({ success: true });
});
```

---

## 📊 Kategorisierung

Die API erkennt automatisch Kategorien basierend auf Keywords:

| Keyword | Kategorie |
|---------|-----------|
| milch, käse, butter | Milchprodukte |
| brot, brötchen | Backwaren |
| fleisch, wurst, lachs | Fleisch & Fisch |
| tomaten, gurken, salat | Obst & Gemüse |
| reis, nudeln, eier | Vorratskammer |
| shampoo, zahnpasta | Körperpflege |

Du kannst auch manuell eine `categoryId` angeben (siehe API.md).

---

## 🧪 Testing

```bash
# Test von CLI aus

curl -X POST https://hangry.kotoro.de/api/external/add-item \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 3475bd78517cc08462ef7062b9360d3c91a6182f01c9514bd48c5e88b7ce2a14" \
  -d '{"name": "Test Item", "quantity": "2 Stück"}'
```

---

## 🎯 Next Steps

1. ✅ API-Key in Braindump `.env` speichern
2. ✅ `hangryService.ts` erstellen
3. ✅ Text-Parsing für "Einkaufen:..." implementieren
4. ✅ Slash Command `/shop` hinzufügen (optional)
5. ✅ Testen mit echten Notes

---

## 📞 Troubleshooting

**401 Unauthorized:**
- API-Key falsch oder fehlt
- Check: `process.env.HANGRY_API_KEY` ist gesetzt

**500 Server Error:**
- Hangry Server logs prüfen: `ssh root@kotoro.de "pm2 logs hangry-server"`

**Items erscheinen nicht in App:**
- WebSocket-Verbindung checken
- Mobile App neu starten

---

Viel Erfolg mit der Integration! 🚀
