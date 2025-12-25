# FleetSignage - Transport Display System Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Workflow](#workflow)
4. [Features](#features)
5. [Technical Specifications](#technical-specifications)
6. [Database Schema](#database-schema)
7. [API Documentation](#api-documentation)
8. [User Guide](#user-guide)
9. [Setup and Installation](#setup-and-installation)
10. [Deployment Guide](#deployment-guide)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance](#maintenance)

---

## System Overview

### Project Description
FleetSignage is a comprehensive digital signage and transport management solution designed for managing up to 1000 buses. The system provides real-time content streaming, GPS tracking, fleet management, and media library capabilities for transportation companies.

### Key Capabilities
- **Fleet Management**: Manage up to 1000 buses with real-time status monitoring
- **Media Streaming**: Upload and stream videos/images to bus displays
- **GPS Tracking**: Real-time location tracking with interactive maps
- **News Broadcasting**: Push news updates to specific buses or depots
- **Smart Scheduling**: Schedule content deployment across fleet or specific routes
- **Real-time Communication**: WebSocket-based real-time updates

### Target Users
- Transportation companies
- Bus fleet operators
- Public transport authorities
- Private transport services

---

## Architecture

### System Components

#### 1. Frontend Dashboard (React + TypeScript)
- **Technology Stack**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Framework**: shadcn/ui components
- **State Management**: React hooks and context
- **Routing**: React Router DOM
- **Real-time**: Socket.io client

#### 2. Backend API (Node.js + Express)
- **Technology Stack**: Node.js, Express.js, Socket.io
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens
- **File Storage**: Cloudinary
- **Real-time**: Socket.io server

#### 3. TV Display App (React)
- **Technology Stack**: React, Webpack
- **Purpose**: Runs on bus displays/TVs
- **Features**: Media playback, GPS display, news ticker
- **Maps**: Mapbox integration

#### 4. Database (Supabase/PostgreSQL)
- **Type**: PostgreSQL with Row Level Security (RLS)
- **Features**: Real-time subscriptions, authentication
- **Storage**: Media files via Cloudinary integration

### System Flow
```
Admin Dashboard → Backend API → Database
     ↓                ↓
TV Displays ← WebSocket ← Real-time Updates
```

---

## Workflow

### End-to-End Overview
- Operator uses the Dashboard to manage buses, upload/select media, create news, and trigger deployments.
- Backend processes uploads, assigns/replaces playlists in the database, and emits real-time events.
- TV Display apps listen for events, fetch their latest playlist/news, and play content.
- Supabase keeps the source-of-truth state (buses, media assignments, news) with optional RLS.

### Media Deployment (Replace) Flow
1. In Dashboard News page, operator selects depot/buses.
2. Optional: clicks a bus number to fetch current playlist and pre-check matching media.
3. Operator selects media assets and clicks "Replace Media on Selected Buses".
4. Frontend POSTs to `/api/media/public/assign` with `{ busIds, items }`.
5. Backend clears existing `media_library` rows for those buses and inserts new rows (atomic replace).
6. Backend emits `media:update` and `playlist:update` via Socket.IO for each affected bus (by id and bus_number) and a global `media:refresh`.
7. TV Display apps receive events, clear current playlist/cache, refetch their playlist, and start playing the new items.

### TV Display Playback Flow
1. Device identifies its bus (deviceId/bus number) and fetches playlist:
   - Try `/api/media/public/bus/:busId`, fallback to `/api/media/public/bus-number/:busNumber`, else global `/api/media/public`.
2. Build playlist and begin playback (videos via HTML5 video, images via timed slideshow).
3. Subscribe to Socket.IO channels for:
   - `media:update` / `playlist:update`: clear and reload playlist; optional cache purge.
   - `news:broadcast`: update ticker when targeting matches deviceId/depot.
4. Optionally render GPS route/progress; listen to `gps:position` updates.

### News Broadcast Flow
1. Operator creates a news item with priority, active flag, and optional targets (depots, deviceIds).
2. Record saved to `news_feeds`; backend emits `news:broadcast` (with targets).
3. Displays filter the event by deviceId/depot and update their ticker when matched.

### Data Ownership and Source of Truth
- `media_content`: Uploaded asset catalog (Cloudinary-backed).
- `media_library`: Assigned playlist per bus (url/type/name/bus_id). This drives what TVs play.
- `buses`: Fleet inventory and metadata (number, depot, route, status, GPS fields).
- `news_feeds`: Stored news items with targeting/priority/active state.

### Operator UX Enhancements
- Clicking a bus number in the Dashboard pre-loads its current `media_library` and pre-selects matching media in the UI, simplifying replace operations.

---

## Features

### 1. Dashboard Overview
- **Real-time Statistics**: Total buses, active buses, media items, schedules
- **Quick Actions**: Deploy content, add buses, upload media
- **System Status**: Live monitoring of fleet status

### 2. Fleet Management
- **Bus Registration**: Add new buses with comprehensive details
- **Bus Information**:
  - Bus number, route, depot
  - Driver and conductor details
  - Capacity, type (EV/Small/Big), running hours
  - GPS coordinates and status
- **Route Management**: Define routes with start/end points
- **Status Monitoring**: Active, maintenance, offline status

### 3. Media Management
- **Media Library**: Upload and organize videos/images
- **Cloud Storage**: Integrated with Cloudinary
- **Media Assignment**: Assign specific media to buses
- **Currently Streaming Detection**: View and manage active content per bus
- **Batch Operations**: Deploy to multiple buses simultaneously

### 4. News Broadcasting
- **News Creation**: Create news feeds with priority levels
- **Targeting**: Target specific buses, depots, or broadcast globally
- **Real-time Push**: Instant news updates via WebSocket
- **Active Management**: Enable/disable news feeds

### 5. GPS Tracking & Maps
- **Real-time Location**: Live GPS tracking of buses
- **Interactive Maps**: Leaflet-based map integration
- **Route Visualization**: Display bus routes and progress
- **Journey Simulation**: Simulate bus journeys for testing

### 6. Display Configuration
- **Device Setup**: Configure display devices
- **Preset Management**: Save and load display configurations
- **Media Playback**: Video/image playback with looping
- **News Ticker**: Scrolling news display

### 7. Scheduling System
- **Content Scheduling**: Schedule media deployment
- **Time-based Control**: Set start/end times for content
- **Priority Management**: Handle content priority levels
- **Active Monitoring**: Track active schedules

---

## Technical Specifications

### Frontend Requirements
- **Node.js**: Version 18 or higher
- **Package Manager**: npm or yarn
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Responsive Design**: Mobile-first approach

### Backend Requirements
- **Node.js**: Version 18 or higher
- **Express.js**: Web framework
- **Socket.io**: Real-time communication
- **Supabase**: Database and authentication
- **Cloudinary**: Media storage

### Database Schema

#### Core Tables

##### 1. Buses Table
```sql
CREATE TABLE buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number TEXT NOT NULL UNIQUE,
  route_name TEXT NOT NULL,
  status bus_status DEFAULT 'active',
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  driver_name TEXT,
  conductor_name TEXT,
  driver_phone TEXT,
  conductor_phone TEXT,
  start_point TEXT,
  end_point TEXT,
  depo TEXT,
  category TEXT CHECK (category IN ('ev', 'small_bus', 'big_bus')),
  sitting_capacity INTEGER,
  running_hours INTEGER CHECK (running_hours IN (12, 15, 24)),
  bus_type TEXT CHECK (bus_type IN ('volvo', 'ac', 'non_ac')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

##### 2. Media Library Table
```sql
CREATE TABLE media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type media_type NOT NULL,
  url TEXT NOT NULL,
  bus_id UUID REFERENCES buses(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

##### 3. News Feeds Table
```sql
CREATE TABLE news_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  target_depots TEXT[],
  target_device_ids TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

##### 4. Routes Table
```sql
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_code TEXT NOT NULL UNIQUE,
  route_name TEXT NOT NULL,
  start_city TEXT NOT NULL,
  end_city TEXT NOT NULL,
  distance_km INTEGER,
  estimated_duration_hours NUMERIC(4,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Environment Variables

#### Frontend (.env)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=your_backend_url
```

#### Backend (.env)
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
PORT=3001
```

---

## API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Bus Management Endpoints
- `GET /api/buses/public` - Get all buses (public)
- `GET /api/buses/public/:busNumber` - Get specific bus by number
- `POST /api/buses` - Create new bus (authenticated)
- `PUT /api/buses/:id` - Update bus (authenticated)
- `DELETE /api/buses/:id` - Delete bus (authenticated)

### Media Management Endpoints
- `GET /api/media/public` - Get all media items
- `GET /api/media/public/bus/:busId` - Get media for specific bus
- `GET /api/media/public/bus-number/:busNumber` - Get media by bus number
- `POST /api/media/public/assign` - Assign media to buses
- `POST /api/media/upload` - Upload media file
- `POST /api/media/public/notify-purge` - Notify clients to purge cache

### News Broadcasting Endpoints
- `GET /api/news/public` - Get active news feeds
- `POST /api/news/public` - Create and broadcast news
- `POST /api/news/push` - Direct news push (no DB save)

### WebSocket Events
- `news:broadcast` - Broadcast news to displays
- `media:update` - Media update notification
- `playlist:update` - Playlist update notification
- `gps:position` - GPS position update

---

## User Guide

### Getting Started

#### 1. Login to Dashboard
1. Navigate to the application URL
2. Enter your credentials
3. Access the main dashboard

#### 2. Fleet Management

##### Adding a New Bus
1. Go to **Fleet Management** page
2. Click **Add New Bus**
3. Fill in bus details:
   - Bus Number (e.g., UK-05-H-8001)
   - Route Name
   - Depot
   - Driver/Conductor information
   - Bus specifications
4. Click **Save**

##### Managing Bus Status
1. View bus list in Fleet Management
2. Update status: Active, Maintenance, Offline
3. Edit bus information as needed
4. Monitor GPS coordinates

#### 3. Media Management

##### Uploading Media
1. Go to **Media** page
2. Click **Upload Media**
3. Select video/image files
4. Add title and description
5. Files are automatically uploaded to cloud storage

##### Assigning Media to Buses
1. Go to **News** page
2. Select target depot or specific buses
3. Choose media items from library
4. Click **Replace Media on Selected Buses**
5. Media is instantly deployed to displays

##### Viewing Currently Streaming Content
1. In **News** page, click on any bus number
2. System fetches currently streaming media
3. Pre-checks matching media items
4. Uncheck items to remove, check new items to add

#### 4. News Broadcasting

##### Creating News Feeds
1. Go to **News** page
2. Enter news message
3. Set priority level (1-5)
4. Choose target (specific bus, depot, or all)
5. Click **Create** or **Push Now**

##### Managing Active News
1. View existing news feeds
2. Toggle active/inactive status
3. Push news immediately
4. Monitor broadcast status

#### 5. GPS Tracking

##### Viewing Bus Locations
1. Go to **Fleet Management**
2. View interactive map
3. See real-time bus positions
4. Track route progress

##### GPS Simulation
1. Go to **GPS Simulator**
2. Select bus and route
3. Start simulation
4. Monitor journey progress

#### 6. Display Configuration

##### Setting Up Display Devices
1. Go to **Display Config**
2. Enter device ID (bus number)
3. Configure display settings
4. Test media playback

##### Managing Presets
1. Create display presets
2. Save configurations
3. Apply presets to multiple devices
4. Customize layouts

---

## Setup and Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Cloudinary account
- Git

### Frontend Setup

1. **Clone Repository**
```bash
git clone <repository-url>
cd transport-display-pro-main
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start Development Server**
```bash
npm run dev
```

### Backend Setup

1. **Navigate to Backend**
```bash
cd backend
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start Backend Server**
```bash
npm run dev
```

### Database Setup

1. **Create Supabase Project**
   - Sign up at supabase.com
   - Create new project
   - Note down URL and keys

2. **Run Migrations**
   - Execute SQL files in `supabase/migrations/`
   - Set up Row Level Security policies
   - Configure authentication

3. **Configure Cloudinary**
   - Sign up at cloudinary.com
   - Get API credentials
   - Configure upload settings

### TV Display App Setup

1. **Navigate to TV App**
```bash
cd tv-display-app
```

2. **Install Dependencies**
```bash
npm install
```

3. **Build for Production**
```bash
npm run build
```

4. **Deploy to Display Devices**
   - Copy built files to display devices
   - Configure device settings
   - Test media playback

---

## Deployment Guide

### Production Deployment

#### Frontend Deployment (Vercel/Netlify)
1. Connect repository to deployment platform
2. Set environment variables
3. Configure build settings
4. Deploy automatically on push

#### Backend Deployment (Render/Railway)
1. Connect repository
2. Set environment variables
3. Configure start command: `npm start`
4. Enable auto-deploy

#### Database Deployment
1. Use Supabase production instance
2. Configure RLS policies
3. Set up monitoring
4. Configure backups

### Environment Configuration

#### Production Environment Variables
```bash
# Frontend
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_BACKEND_URL=https://your-backend-url.com

# Backend
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NODE_ENV=production
PORT=3001
```

### SSL and Security
- Enable HTTPS for all endpoints
- Configure CORS properly
- Use secure WebSocket connections
- Implement rate limiting
- Regular security updates

---

## Troubleshooting

### Common Issues

#### 1. Media Not Playing on Displays
**Symptoms**: Videos/images not displaying on bus TVs
**Solutions**:
- Check network connectivity
- Verify media URLs are accessible
- Check browser console for errors
- Ensure media format is supported

#### 2. GPS Tracking Not Working
**Symptoms**: Bus locations not updating
**Solutions**:
- Verify GPS permissions
- Check WebSocket connection
- Validate GPS coordinates
- Test with GPS simulator

#### 3. News Not Broadcasting
**Symptoms**: News updates not appearing
**Solutions**:
- Check WebSocket connection
- Verify targeting settings
- Check news feed status
- Test with direct push

#### 4. Authentication Issues
**Symptoms**: Login failures, permission errors
**Solutions**:
- Verify Supabase configuration
- Check RLS policies
- Validate JWT tokens
- Clear browser cache

#### 5. Upload Failures
**Symptoms**: Media uploads failing
**Solutions**:
- Check Cloudinary configuration
- Verify file size limits
- Check network connectivity
- Validate file formats

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=transport-display:*
```

### Log Files
- Frontend: Browser console
- Backend: Server logs
- Database: Supabase logs
- Cloudinary: Upload logs

---

## Maintenance

### Regular Tasks

#### Daily
- Monitor system health
- Check error logs
- Verify media playback
- Monitor GPS tracking

#### Weekly
- Review system performance
- Check storage usage
- Update media library
- Review user access

#### Monthly
- Security updates
- Database optimization
- Backup verification
- Performance analysis

### Monitoring

#### Key Metrics
- Active buses count
- Media playback success rate
- GPS update frequency
- WebSocket connection stability
- Upload success rate

#### Alerts
- System downtime
- High error rates
- Storage quota warnings
- Authentication failures

### Backup Strategy
- Database: Daily automated backups
- Media files: Cloudinary redundancy
- Configuration: Version control
- User data: Regular exports

### Updates and Patches
- Regular dependency updates
- Security patch management
- Feature updates
- Performance optimizations

---

## Support and Contact

### Technical Support
- Documentation: This document
- Issues: GitHub issues
- Community: Project forums
- Email: support@fleetsignage.com

### Development Team
- Lead Developer: [Name]
- Backend Developer: [Name]
- Frontend Developer: [Name]
- DevOps Engineer: [Name]

### License
This project is licensed under [License Type] - see LICENSE file for details.

---

*Last Updated: [Current Date]*
*Version: 1.0.0*
*Documentation Version: 1.0*
