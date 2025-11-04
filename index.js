require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

const PORT = process.env.PORT || 3002;
const DATA_FILE = path.join(__dirname, 'shopping-list.json');
const CATEGORIES_FILE = path.join(__dirname, 'categories.json');
const API_KEY = process.env.API_KEY || 'your-secret-api-key-here'; // Change in production!

// Middleware
app.use(cors());
app.use(express.json());

// API Key Authentication Middleware (for external API calls)
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid or missing API key'
    });
  }

  next();
}

// Helper: Load shopping list from file
async function loadShoppingList() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty list
    return { items: [], lastModified: new Date().toISOString() };
  }
}

// Helper: Save shopping list to file
async function saveShoppingList(list) {
  const updatedList = {
    ...list,
    lastModified: new Date().toISOString()
  };
  await fs.writeFile(DATA_FILE, JSON.stringify(updatedList, null, 2));
  return updatedList;
}

// Helper: Load custom categories from file
async function loadCategories() {
  try {
    const data = await fs.readFile(CATEGORIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array (client will use defaults)
    return [];
  }
}

// Helper: Save custom categories to file
async function saveCategories(categories) {
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2));
  return categories;
}

// Helper: Auto-classify item into category based on keywords
function classifyItem(itemName) {
  const CATEGORY_KEYWORDS = {
    'fruits-vegetables': [
      'apfel', 'äpfel', 'banane', 'orange', 'tomate', 'tomaten', 'gurke', 'gurken',
      'salat', 'karotte', 'karotten', 'möhre', 'möhren', 'zwiebel', 'zwiebeln',
      'kartoffel', 'kartoffeln', 'paprika', 'zucchini', 'brokkoli', 'blumenkohl',
      'spinat', 'avocado', 'mango', 'erdbeere', 'erdbeeren', 'trauben', 'birne',
      'kiwi', 'ananas', 'melone', 'zitrone', 'limette', 'obst', 'gemüse'
    ],
    'dairy-cheese': [
      'milch', 'käse', 'butter', 'joghurt', 'quark', 'sahne', 'schmand',
      'frischkäse', 'mozzarella', 'gouda', 'emmentaler', 'parmesan', 'feta',
      'creme', 'mascarpone', 'ricotta', 'camembert', 'pudding'
    ],
    'meat-fish': [
      'fleisch', 'wurst', 'hähnchen', 'huhn', 'pute', 'rind', 'schwein',
      'hackfleisch', 'schnitzel', 'steak', 'bratwurst', 'salami', 'schinken',
      'lachs', 'thunfisch', 'fisch', 'garnele', 'garnelen', 'forelle'
    ],
    'bakery': [
      'brot', 'brötchen', 'croissant', 'toast', 'baguette', 'kuchen',
      'torte', 'gebäck', 'muffin', 'donut', 'brezel', 'semmel'
    ],
    'pantry': [
      'reis', 'nudeln', 'pasta', 'spaghetti', 'mehl', 'zucker', 'salz',
      'pfeffer', 'öl', 'essig', 'honig', 'marmelade', 'nutella', 'konserve',
      'dose', 'sauce', 'ketchup', 'senf', 'mayo', 'mayonnaise', 'müsli',
      'cornflakes', 'haferflocken', 'gewürz', 'gewürze', 'tee', 'kaffee', 'eier', 'ei'
    ],
    'frozen': [
      'tk', 'tiefkühl', 'pizza', 'pommes', 'eis', 'eiscreme', 'geforen',
      'tiefgefroren', 'fischstäbchen', 'spinat tk'
    ],
    'beverages': [
      'wasser', 'saft', 'limo', 'limonade', 'cola', 'sprite', 'fanta',
      'bier', 'wein', 'sprudel', 'mineralwasser', 'apfelschorle', 'getränk',
      'smoothie', 'energydrink', 'eistee'
    ],
    'snacks': [
      'chips', 'schokolade', 'schoko', 'keks', 'kekse', 'gummibärchen',
      'bonbon', 'süßigkeit', 'riegel', 'snack', 'knabber', 'nüsse',
      'erdnüsse', 'mandeln', 'popcorn', 'nachos'
    ],
    'household': [
      'spülmittel', 'waschmittel', 'putzmittel', 'reiniger', 'schwamm',
      'müllbeutel', 'mülltüte', 'toilettenpapier', 'klopapier', 'küchenrolle',
      'serviette', 'servietten', 'alufolie', 'frischhaltefolie', 'backpapier'
    ],
    'personal-care': [
      'shampoo', 'duschgel', 'seife', 'zahnpasta', 'zahnbürste', 'deo',
      'creme', 'bodylotion', 'rasierer', 'rasier', 'tampons', 'binden',
      'windel', 'windeln', 'parfüm'
    ],
  };

  const normalizedName = itemName.toLowerCase().trim();

  // Search through all categories for keyword matches
  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        return categoryId;
      }
    }
  }

  // Default: 'other' category
  return 'other';
}

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'shopping-list-server',
    time: new Date().toISOString()
  });
});

// ============================================================================
// EXTERNAL API ENDPOINTS (require API key)
// ============================================================================

// POST /api/external/add-item - Add item from external application (e.g. Braindump)
// Requires API key authentication
app.post('/api/external/add-item', requireApiKey, async (req, res) => {
  try {
    const { name, categoryId, quantity, items } = req.body;

    // Validate input
    if (!name && !items) {
      return res.status(400).json({
        success: false,
        error: 'Either "name" or "items" array is required'
      });
    }

    const list = await loadShoppingList();
    const addedItems = [];

    // Handle single item
    if (name) {
      const detectedCategory = categoryId || classifyItem(name);

      const newItem = {
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        categoryId: detectedCategory,
        quantity: quantity || undefined,
        checked: false,
        createdAt: new Date().toISOString(),
        checkedAt: undefined
      };

      list.items.push(newItem);
      addedItems.push(newItem);
    }

    // Handle multiple items (batch add)
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (!item.name) continue; // Skip items without name

        const detectedCategory = item.categoryId || classifyItem(item.name);

        const newItem = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
          name: item.name.trim(),
          categoryId: detectedCategory,
          quantity: item.quantity || undefined,
          checked: false,
          createdAt: new Date().toISOString(),
          checkedAt: undefined
        };

        list.items.push(newItem);
        addedItems.push(newItem);
      }
    }

    if (addedItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid items to add'
      });
    }

    const updatedList = await saveShoppingList(list);

    // Broadcast to all connected mobile clients
    io.emit('list-updated', updatedList);

    res.json({
      success: true,
      message: `Successfully added ${addedItems.length} item(s)`,
      data: {
        addedItems,
        totalItems: updatedList.items.length
      }
    });
  } catch (error) {
    console.error('Error adding item via external API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/external/add-items - Batch add multiple items (alias for compatibility)
app.post('/api/external/add-items', requireApiKey, async (req, res) => {
  // Forward to add-item endpoint
  req.body = { items: req.body.items || req.body };
  return app._router.handle(req, res);
});

// ============================================================================
// INTERNAL API ENDPOINTS (for mobile app)
// ============================================================================

// GET /api/shopping/list - Get complete shopping list
app.get('/api/shopping/list', async (req, res) => {
  try {
    const list = await loadShoppingList();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error loading list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/shopping/items - Add new item
app.post('/api/shopping/items', async (req, res) => {
  try {
    const { name, categoryId, quantity, checked, details } = req.body;

    if (!name || !categoryId) {
      return res.status(400).json({
        success: false,
        error: 'name and categoryId are required'
      });
    }

    const list = await loadShoppingList();

    const trimmedDetails = typeof details === 'string' ? details.trim() : '';

    const newItem = {
      id: Date.now().toString(),
      name,
      categoryId,
      quantity: quantity || undefined,
      details: trimmedDetails.length > 0 ? trimmedDetails : undefined,
      checked: checked || false,
      createdAt: new Date().toISOString(),
      checkedAt: undefined
    };

    list.items.push(newItem);
    const updatedList = await saveShoppingList(list);

    // Broadcast to all connected clients
    io.emit('list-updated', updatedList);

    res.json({ success: true, data: newItem });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/shopping/items/:id - Update item
app.patch('/api/shopping/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const list = await loadShoppingList();
    const itemIndex = list.items.findIndex(item => item.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const sanitizedUpdates = { ...updates };

    if (Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'details')) {
      if (typeof sanitizedUpdates.details === 'string') {
        const trimmedDetails = sanitizedUpdates.details.trim();
        sanitizedUpdates.details = trimmedDetails.length > 0 ? trimmedDetails : undefined;
      } else if (sanitizedUpdates.details === null) {
        sanitizedUpdates.details = undefined;
      }
    }

    // Update item
    const updatedItem = {
      ...list.items[itemIndex],
      ...sanitizedUpdates
    };

    // If toggling checked state, update checkedAt
    if ('checked' in updates) {
      updatedItem.checkedAt = updates.checked
        ? new Date().toISOString()
        : undefined;
    }

    if (sanitizedUpdates.details === undefined) {
      delete updatedItem.details;
    }

    list.items[itemIndex] = updatedItem;

    const updatedList = await saveShoppingList(list);

    // Broadcast to all connected clients
    io.emit('list-updated', updatedList);

    res.json({ success: true, data: list.items[itemIndex] });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/shopping/items/:id - Delete item
app.delete('/api/shopping/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const list = await loadShoppingList();
    const itemIndex = list.items.findIndex(item => item.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    list.items.splice(itemIndex, 1);
    const updatedList = await saveShoppingList(list);

    // Broadcast to all connected clients
    io.emit('list-updated', updatedList);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/shopping/items - Delete all checked items
app.delete('/api/shopping/items', async (req, res) => {
  try {
    const list = await loadShoppingList();
    list.items = list.items.filter(item => !item.checked);
    const updatedList = await saveShoppingList(list);

    // Broadcast to all connected clients
    io.emit('list-updated', updatedList);

    res.json({ success: true, data: updatedList });
  } catch (error) {
    console.error('Error clearing checked items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CATEGORIES API ENDPOINTS
// ============================================================================

// GET /api/shopping/categories - Get custom categories
app.get('/api/shopping/categories', async (req, res) => {
  try {
    const categories = await loadCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error loading categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/shopping/categories - Save custom categories
app.post('/api/shopping/categories', async (req, res) => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        error: 'categories must be an array'
      });
    }

    const savedCategories = await saveCategories(categories);

    // Broadcast to all connected clients
    io.emit('categories-updated', savedCategories);

    res.json({ success: true, data: savedCategories });
  } catch (error) {
    console.error('Error saving categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/shopping/categories - Reset to default categories
app.delete('/api/shopping/categories', async (req, res) => {
  try {
    // Remove categories file to reset to defaults
    try {
      await fs.unlink(CATEGORIES_FILE);
    } catch (error) {
      // File might not exist, that's fine
    }

    // Broadcast to all connected clients
    io.emit('categories-updated', []);

    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Client can request full sync
  socket.on('request-sync', async () => {
    try {
      const list = await loadShoppingList();
      socket.emit('list-updated', list);
    } catch (error) {
      console.error('Error syncing:', error);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`[shopping-list-server] listening on http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
