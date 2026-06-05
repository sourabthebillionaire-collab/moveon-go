# MoveOn Go - Real-Time Bus Tracking & Booking Platform

A full-stack web application for real-time bus tracking, booking, and fare management with driver and admin dashboards.

## 🌟 Features

### User Features
- **Phone-based Authentication**: OAuth-like authentication with OTP verification
- **Real-Time Bus Tracking**: Live GPS tracking of buses on interactive Leaflet maps
- **Bus Booking**: Search, select, and book available buses with pickup/dropoff coordinates
- **Fare Calculation**: Dynamic fare pricing based on distance and route
- **Booking History**: Track past and current bookings
- **Favorites**: Save frequently used routes for quick booking
- **Payment Tracking**: View payment status and history
- **PWA Support**: Install app on mobile for offline-first experience
- **Profile Management**: Update personal information and preferences

### Driver Features
- **Driver Registration**: Register with vehicle details and auto-generated vehicle ID
- **Duty Management**: Toggle on/off-duty status
- **Real-Time Location Broadcast**: Live GPS location sharing via Socket.io
- **Earnings Dashboard**: Track daily earnings and trip history
- **Vehicle Management**: View and manage assigned vehicles

### Admin Features
- **User Management**: View, manage, and deactivate user accounts
- **Driver Management**: Approve drivers, manage fleet
- **Route Configuration**: Create and manage bus routes
- **Fare Settings**: Configure fare rates and surcharges
- **System Analytics**: Monitor platform usage and revenue

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **Real-Time Communication**: Socket.io
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, bcryptjs
- **Logging**: Morgan
- **Deployment**: Docker, Render, Vercel

### Frontend
- **Library**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v7
- **Maps**: Leaflet
- **Real-Time Client**: Socket.io-client
- **Styling**: CSS3 with responsive design
- **State Management**: Context API & React Hooks
- **PWA**: Installable web app

### Database
- **Primary**: MongoDB Atlas (cloud)
- **Schema**: Document-based with indexes

## 📋 Prerequisites

- Node.js 16+ and npm/yarn
- MongoDB Atlas account (free tier available)
- Google Maps API key (optional, for geocoding)
- Internet connection for real-time features

## 🚀 Quick Start

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
cp frontend.env .env
# Edit .env with your backend API URL
npm run dev
```

The application will be available at `http://localhost:5173` (frontend) and backend at `http://localhost:5000`.

## 📖 Detailed Documentation

- **[Backend Setup Guide](backend/QUICK_START.md)**: Comprehensive backend configuration
- **[Development Setup](README_DEV_SETUP.md)**: Full development environment setup
- **[Environment Variables](ENVIRONMENT_VARIABLES.md)**: All configuration options
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)**: Production deployment steps
- **[Security Guide](backend/SECURITY.md)**: Security best practices and vulnerabilities
- **[Docker Deployment](QUICK_DEPLOY.md)**: Containerized deployment

## 🔐 Authentication

The app uses JWT-based authentication with separate tokens for users and drivers:
- **User Token**: 30-day expiration for passenger bookings
- **Driver Token**: Separate token for driver operations
- **Phone Verification**: OTP-based initial authentication
- **Password Hashing**: bcryptjs with salt rounds for security

## 🗺️ API Endpoints

### Auth Routes
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP and get token
- `POST /api/auth/logout` - Logout user

### User Routes
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/bookings` - Get user bookings

### Booking Routes
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Driver Routes
- `POST /api/driver/register` - Register as driver
- `PUT /api/driver/duty` - Toggle duty status
- `GET /api/driver/earnings` - Get earnings data

### Buses Routes
- `GET /api/buses` - List available buses
- `GET /api/buses/search` - Search buses by route

### Admin Routes
- `GET /api/admin/users` - Manage users
- `GET /api/admin/drivers` - Manage drivers
- `POST /api/admin/routes` - Create routes
- `PUT /api/admin/fares` - Update fares

For more details, see the [Backend Setup Guide](backend/QUICK_START.md).

## 🔄 Real-Time Features

The app uses Socket.io for real-time updates:
- **Driver Location Updates**: Broadcast driver GPS location every second
- **Booking Status Updates**: Real-time booking status changes
- **Trip Tracking**: Live trip progress for booked trips

```javascript
// Example: Connect to real-time driver tracking
const socket = io('http://localhost:5000');
socket.on('driverLocationUpdate', (data) => {
  console.log(`Driver ${data.driverId} is at`, data.location);
});
```

## 📱 Mobile Responsiveness

The frontend is fully responsive:
- **Mobile**: 375px and up
- **Tablet**: 768px and up
- **Desktop**: 1024px and up

PWA installation banner appears on compatible devices for native app-like experience.

## 🐛 Known Issues

See [Frontend UI Bugs Report](FRONTEND_UI_BUGS_REPORT.md) for current issues and workarounds.

### Critical Gaps (Production Ready Checklist)
- ⚠️ Rate limiting not applied to routes (security)
- ⚠️ CORS configuration uses `origin: '*'` (security risk)
- ⚠️ No input validation library (joi/zod)
- ⚠️ No comprehensive error logging
- ⚠️ No request timeout configuration
- ⚠️ No database migration system
- ⚠️ No API documentation (Swagger/OpenAPI)

See [Security Guide](backend/SECURITY.md) for detailed security recommendations.

## 📊 Project Structure

```
bus-tracker/
├── backend/                    # Express.js backend
│   ├── routes/                # API route handlers
│   ├── models/                # MongoDB schemas
│   ├── middleware/            # Auth & logging middleware
│   ├── utils/                 # Helpers & validation
│   ├── socket/                # Socket.io handlers
│   ├── server.js              # Entry point
│   └── package.json
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API & socket clients
│   │   ├── hooks/             # Custom React hooks
│   │   ├── utils/             # Helper functions
│   │   ├── context/           # Context API states
│   │   └── App.jsx
│   └── package.json
├── docker-compose.yml         # Docker orchestration
├── Procfile                   # Heroku deployment
└── package.json               # Root package (if monorepo)
```

## 🚢 Deployment

### Quick Deploy Options

1. **Render (Free Tier)**
   - See [Render Free Deploy](RENDER_FREE_DEPLOY.md)
   - Frontend: Render Static Site
   - Backend: Render Web Service (free tier restarts after 15 min inactivity)

2. **Vercel + Render**
   - See [Vercel Render Deploy](VERCEL_RENDER_DEPLOY.md)
   - Frontend: Vercel (fast global CDN)
   - Backend: Render (Node.js)

3. **Docker Compose**
   - See [Quick Deploy](QUICK_DEPLOY.md)
   - Local development: `docker-compose up`
   - Production: Deploy to Docker-compatible host

### Environment Variables for Production

```bash
# Backend
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=your-secure-random-secret
ADMIN_PASSWORD=your-admin-password
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# Frontend
VITE_API_URL=https://api.your-domain.com
VITE_SOCKET_URL=https://api.your-domain.com
```

## 🧪 Testing

Currently no automated tests. Recommended additions:
- Unit tests: Jest for backend, Vitest for frontend
- Integration tests: Supertest for API endpoints
- E2E tests: Cypress or Playwright
- Load testing: k6 or Artillery

## 📝 License

This project is proprietary. All rights reserved.

## 👥 Support

- **Documentation**: See [Development Setup](README_DEV_SETUP.md)
- **Issues**: Check [Frontend UI Bugs Report](FRONTEND_UI_BUGS_REPORT.md)
- **Deployment**: See [Deployment Guide](DEPLOYMENT_GUIDE.md)

## 🔄 Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit a pull request
5. After merge to main: Deploy to production

## 🎯 Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Payment gateway integration (Stripe/Flutterwave)
- [ ] Driver background verification
- [ ] Insurance coverage tracking
- [ ] Multi-language support (i18n)
- [ ] Advanced analytics & reporting
- [ ] AI-based fare prediction
- [ ] Trip sharing & ride pooling
- [ ] Customer rating & reviews
- [ ] Push notifications

---

**Last Updated**: June 2026  
**Version**: 1.0.0  
**Status**: Active Development
