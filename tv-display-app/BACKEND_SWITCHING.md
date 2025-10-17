# Backend Switching Guide for TV Display App

This guide explains how to easily switch between production and local backends for testing.

## Quick Commands

```bash
# Switch to local backend (http://localhost:4000)
node switch-backend.js local

# Switch to production backend (https://transport-display.onrender.com)
node switch-backend.js prod

# Check current backend status
node switch-backend.js status
```

## How It Works

The TV Display App now uses a centralized configuration system that automatically detects the best backend to use:

1. **Environment Variable**: If `VITE_BACKEND_URL` is set, it uses that
2. **Localhost Detection**: If running on localhost, defaults to local backend
3. **Production Default**: Otherwise uses production backend

## Configuration Files

- **`src/config/backend.js`**: Main configuration file
- **`switch-backend.js`**: Helper script to switch backends
- **Backup**: Automatically creates `.backup` files

## Testing Workflow

### For Local Development:
```bash
# 1. Start your local backend
cd backend
npm start

# 2. Switch TV display to local backend
cd ../tv-display-app
node switch-backend.js local

# 3. Start TV display app
npm start

# 4. Test your changes
# TV display will connect to http://localhost:4000
```

### For Production Testing:
```bash
# 1. Switch to production backend
cd tv-display-app
node switch-backend.js prod

# 2. Start TV display app
npm start

# 3. Test with production data
# TV display will connect to https://transport-display.onrender.com
```

## Environment Variables (Alternative)

You can also use environment variables instead of the script:

```bash
# For local backend
export VITE_BACKEND_URL=http://localhost:4000
npm start

# For production backend
export VITE_BACKEND_URL=https://transport-display.onrender.com
npm start
```

## Debugging

The app logs which backend it's using:
```
🔗 TV Display App using backend: http://localhost:4000
```

## File Structure

```
tv-display-app/
├── src/
│   ├── config/
│   │   └── backend.js          # Main config
│   ├── services/
│   │   └── api.js              # Uses config
│   └── components/
│       └── Display.jsx         # Uses config
├── switch-backend.js           # Helper script
└── BACKEND_SWITCHING.md        # This guide
```

## Benefits

✅ **Easy switching** between local and production  
✅ **Automatic detection** based on environment  
✅ **No code changes** needed to switch backends  
✅ **Backup system** prevents configuration loss  
✅ **Clear logging** shows which backend is active  
✅ **Environment variable** support for CI/CD  

## Troubleshooting

### TV Display not connecting:
1. Check which backend is active: `node switch-backend.js status`
2. Verify backend is running (local: http://localhost:4000/api/health)
3. Check browser console for connection errors
4. Ensure CORS is properly configured on backend

### Wrong backend being used:
1. Clear browser cache
2. Restart the TV display app
3. Check environment variables
4. Verify config file content
