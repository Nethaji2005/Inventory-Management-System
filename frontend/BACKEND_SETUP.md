# Backend Setup Guide

## Prerequisites
- **Node.js** (v16 or higher)
- **MongoDB** (running locally or Atlas)
- **npm** or **bun** package manager

## Quick Start

### 1. Start MongoDB
Make sure MongoDB is running on your system:

**Windows:**
```bash
mongod
```

**Mac/Linux:**
```bash
brew services start mongodb-community
# or
mongod
```

**MongoDB Atlas (Cloud):**
- If using MongoDB Atlas, update `MONGO_URI` in your `.env` file with your connection string

### 2. Install Dependencies
```bash
cd pocket-shop-assist-main
npm install
# or
bun install
```

### 3. Create `.env` file (if needed)
Create a `.env` file in the root directory:
```env
MONGO_URI=mongodb://127.0.0.1:27017/pocket-shop
PORT=5000
```

### 4. Start the Backend Server
```bash
npm run dev
# or
bun run dev
# or (direct)
node server.js
```

You should see:
```
✅ MongoDB connected successfully
✅ Server running on http://localhost:5000
📝 API available at http://localhost:5000/api
```

### 5. Test Backend Connection
In another terminal, test the health endpoint:
```bash
curl http://localhost:5000/api/health
```

Should return:
```json
{
  "status": "Server is running",
  "timestamp": "2025-11-17T..."
}
```

### 6. Start Frontend (in another terminal)
```bash
npm run dev
```

## Troubleshooting

### "Failed to fetch" error
**Problem:** Frontend can't connect to backend

**Solutions:**
1. ✅ Make sure backend is running on `http://localhost:5000`
2. ✅ Check MongoDB is running: `mongod`
3. ✅ Check firewall isn't blocking port 5000
4. ✅ Check console for error messages

### MongoDB Connection Error
**Problem:** `❌ MongoDB connection error`

**Solutions:**
1. Start MongoDB: `mongod`
2. Check MongoDB version: `mongod --version`
3. If using Docker: `docker run -d -p 27017:27017 mongo`
4. Check `.env` MONGO_URI is correct

### Port Already in Use
**Problem:** `Error: listen EADDRINUSE: address already in use :::5000`

**Solution:**
```bash
# Kill process on port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :5000
kill -9 <PID>
```

Or use a different port:
```bash
PORT=5001 node server.js
```

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `GET /api/products/distinct?field=type` - Get distinct field values

### Health
- `GET /api/health` - Check server status

## Environment Variables
```env
MONGO_URI=mongodb://127.0.0.1:27017/pocket-shop  # MongoDB connection string
PORT=5000                                          # Server port
NODE_ENV=development                              # Environment
```

## Running in Production
```bash
NODE_ENV=production node server.js
```

## Need Help?
1. Check console logs for error messages
2. Verify MongoDB is running
3. Ensure port 5000 is available
4. Check CORS settings in `server.js`
