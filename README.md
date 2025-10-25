# Shopping List Server

Real-time synchronization server for the shopping list app.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Server Details

- **Port:** 3001 (default, configurable via PORT env variable)
- **Data Storage:** `shopping-list.json` file
- **Real-time:** Socket.io for instant sync between clients

## API Endpoints

### GET /api/shopping/list
Get the complete shopping list

### POST /api/shopping/items
Add a new item
```json
{
  "name": "Milk",
  "categoryId": "dairy-cheese",
  "quantity": "1L",
  "checked": false
}
```

### PATCH /api/shopping/items/:id
Update an item (partial update)
```json
{
  "checked": true
}
```

### DELETE /api/shopping/items/:id
Delete a specific item

### DELETE /api/shopping/items
Delete all checked items

## WebSocket Events

### Client → Server
- `request-sync` - Request full list sync

### Server → Client
- `list-updated` - Broadcasts updated list to all clients

## Deployment

For production, consider:
1. Using PM2 to keep the server running
2. Setting up Nginx reverse proxy
3. Using a subdomain (e.g., `shopping.yourdomain.de`)

Example PM2 config:
```bash
pm2 start index.js --name shopping-list-server
pm2 save
pm2 startup
```
