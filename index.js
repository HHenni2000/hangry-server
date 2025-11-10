const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

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
const LOCK_FILE = path.join(__dirname, 'shopping-list.lock');

// Middleware
app.use(cors());
app.use(express.json());

// Request ID middleware for tracking parallel requests
app.use((req, res, next) => {
  req.requestId = crypto.randomBytes(8).toString('hex');
  console.log(`[${req.requestId}] ${req.method} ${req.path}`);
  next();
});

// File-based locking mechanism to prevent race conditions
class FileLock {
  constructor(lockFile, options = {}) {
    this.lockFile = lockFile;
    this.maxRetries = options.maxRetries || 50;
    this.retryDelay = options.retryDelay || 50; // ms
    this.lockTimeout = options.lockTimeout || 5000; // ms
  }

  async acquire(requestId) {
    const lockId = `${requestId}-${Date.now()}`;
    const startTime = Date.now();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Try to create lock file (fails if exists)
        await fs.writeFile(this.lockFile, lockId, { flag: 'wx' });
        console.log(`[${requestId}] Lock acquired (attempt ${attempt + 1})`);
        return lockId;
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }

        // Check if lock is stale (older than timeout)
        try {
          const stat = await fs.stat(this.lockFile);
          const lockAge = Date.now() - stat.mtimeMs;

          if (lockAge > this.lockTimeout) {
            console.log(`[${requestId}] Breaking stale lock (age: ${lockAge}ms)`);
            await fs.unlink(this.lockFile).catch(() => {});
            continue;
          }
        } catch (statError) {
          // Lock file might have been deleted, retry
        }

        // Wait before retry
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    const waitTime = Date.now() - startTime;
    throw new Error(`Failed to acquire lock after ${waitTime}ms`);
  }

  async release(lockId, requestId) {
    try {
      const currentLock = await fs.readFile(this.lockFile, 'utf8');
      if (currentLock === lockId) {
        await fs.unlink(this.lockFile);
        console.log(`[${requestId}] Lock released`);
      } else {
        console.warn(`[${requestId}] Lock ID mismatch, not releasing`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[${requestId}] Error releasing lock:`, error);
      }
    }
  }

  async withLock(requestId, callback) {
    let lockId;
    try {
      lockId = await this.acquire(requestId);
      return await callback();
    } finally {
      if (lockId) {
        await this.release(lockId, requestId);
      }
    }
  }
}

const fileLock = new FileLock(LOCK_FILE);

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
  const { requestId } = req;
  try {
    const { name, categoryId, quantity, checked } = req.body;

    if (!name || !categoryId) {
      return res.status(400).json({
        success: false,
        error: 'name and categoryId are required'
      });
    }

    console.log(`[${requestId}] Adding item: ${name}`);

    const newItem = await fileLock.withLock(requestId, async () => {
      const list = await loadShoppingList();

      const item = {
        id: Date.now().toString(),
        name,
        categoryId,
        quantity: quantity || undefined,
        checked: checked || false,
        createdAt: new Date().toISOString(),
        checkedAt: undefined
      };

      list.items.push(item);
      const updatedList = await saveShoppingList(list);

      // Broadcast to all connected clients
      io.emit('list-updated', updatedList);

      return item;
    });

    console.log(`[${requestId}] Item added successfully: ${newItem.id}`);
    res.json({ success: true, data: newItem });
  } catch (error) {
    console.error(`[${requestId}] Error adding item:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/external/add-item - Simplified endpoint for external integrations (e.g., Hangry app)
// Only requires 'name', uses default categoryId 'other'
app.post('/api/external/add-item', async (req, res) => {
  const { requestId } = req;
  try {
    const { name, quantity } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    console.log(`[${requestId}] External: Adding item: ${name}`);

    const newItem = await fileLock.withLock(requestId, async () => {
      const list = await loadShoppingList();

      const item = {
        id: Date.now().toString(),
        name,
        categoryId: 'other', // Default category for external items
        quantity: quantity || undefined,
        checked: false,
        createdAt: new Date().toISOString(),
        checkedAt: undefined
      };

      list.items.push(item);
      const updatedList = await saveShoppingList(list);

      console.log(`[${requestId}] External: Item pushed to list (total items: ${list.items.length})`);

      // Broadcast to all connected clients
      io.emit('list-updated', updatedList);

      return item;
    });

    console.log(`[${requestId}] External: Item added successfully: ${newItem.id}`);
    res.json({
      success: true,
      message: `Successfully added 1 item(s)`,
      data: newItem
    });
  } catch (error) {
    console.error(`[${requestId}] External: Error adding item:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/shopping/items/:id - Update item
app.patch('/api/shopping/items/:id', async (req, res) => {
  const { requestId } = req;
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`[${requestId}] Updating item: ${id}`);

    const updatedItem = await fileLock.withLock(requestId, async () => {
      const list = await loadShoppingList();
      const itemIndex = list.items.findIndex(item => item.id === id);

      if (itemIndex === -1) {
        throw new Error('Item not found');
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

      return list.items[itemIndex];
    });

    console.log(`[${requestId}] Item updated successfully: ${id}`);
    res.json({ success: true, data: updatedItem });
  } catch (error) {
    if (error.message === 'Item not found') {
      console.log(`[${requestId}] Item not found: ${req.params.id}`);
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    console.error(`[${requestId}] Error updating item:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/shopping/items/:id - Delete item
app.delete('/api/shopping/items/:id', async (req, res) => {
  const { requestId } = req;
  try {
    const { id } = req.params;

    console.log(`[${requestId}] Deleting item: ${id}`);

    await fileLock.withLock(requestId, async () => {
      const list = await loadShoppingList();
      const itemIndex = list.items.findIndex(item => item.id === id);

      if (itemIndex === -1) {
        throw new Error('Item not found');
      }

      list.items.splice(itemIndex, 1);
      const updatedList = await saveShoppingList(list);

      // Broadcast to all connected clients
      io.emit('list-updated', updatedList);
    });

    console.log(`[${requestId}] Item deleted successfully: ${id}`);
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'Item not found') {
      console.log(`[${requestId}] Item not found: ${req.params.id}`);
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    console.error(`[${requestId}] Error deleting item:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/shopping/items - Delete all checked items
app.delete('/api/shopping/items', async (req, res) => {
  const { requestId } = req;
  try {
    console.log(`[${requestId}] Clearing checked items`);

    const updatedList = await fileLock.withLock(requestId, async () => {
      const list = await loadShoppingList();
      const beforeCount = list.items.length;
      list.items = list.items.filter(item => !item.checked);
      const afterCount = list.items.length;
      const deletedCount = beforeCount - afterCount;

      const updated = await saveShoppingList(list);

      console.log(`[${requestId}] Deleted ${deletedCount} checked items`);

      // Broadcast to all connected clients
      io.emit('list-updated', updated);

      return updated;
    });

    res.json({ success: true, data: updatedList });
  } catch (error) {
    console.error(`[${requestId}] Error clearing checked items:`, error);
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
