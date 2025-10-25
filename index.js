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

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'shopping-list.json');

// Middleware
app.use(cors());
app.use(express.json());

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

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'shopping-list-server',
    time: new Date().toISOString()
  });
});

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
    const { name, categoryId, quantity, checked } = req.body;

    if (!name || !categoryId) {
      return res.status(400).json({
        success: false,
        error: 'name and categoryId are required'
      });
    }

    const list = await loadShoppingList();

    const newItem = {
      id: Date.now().toString(),
      name,
      categoryId,
      quantity: quantity || undefined,
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

    // Update item
    list.items[itemIndex] = {
      ...list.items[itemIndex],
      ...updates
    };

    // If toggling checked state, update checkedAt
    if ('checked' in updates) {
      list.items[itemIndex].checkedAt = updates.checked
        ? new Date().toISOString()
        : undefined;
    }

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
