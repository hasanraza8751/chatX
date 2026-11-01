# ChatX 💬

A modern, real-time messaging application built with React, Node.js, Express, MongoDB and Socket.IO.

ChatX provides a smooth messaging experience with real-time communication, media sharing, read receipts, typing indicators, and multilingual message translation.

**Live Demo:** https://chat-x-beta.vercel.app

## ✨ Features

### Real-Time Messaging

* Instant one-to-one messaging using Socket.IO.
* Persistent message history.
* Online/offline presence indicators.
* Last seen status.
* Typing indicators.

### Message Features

* Sent, delivered and read receipts.
* Reply to messages.
* Copy message text.
* Unread message indicators.
* Browser notifications.

### Media Sharing

* Image sharing.
* Video messaging.
* Voice messages.
* Cloudinary media storage.

### Multilingual Translation

* English, Hindi, Bengali and Tamil support.
* Language detection.
* Romanized language handling (Hinglish, Banglish and Tanglish).
* Manual message translation.
* Automatic translation mode.
* Original message preservation.
* Translation caching.

### User Experience

* Responsive interface.
* Dark neumorphic design.
* Animated message transitions.
* User profiles.
* Search users by username.

## 🛠️ Tech Stack

**Frontend**

* React
* Vite
* JavaScript
* CSS

**Backend**

* Node.js
* Express.js
* Socket.IO

**Database**

* MongoDB Atlas
* Mongoose

**Authentication & Security**

* JWT authentication
* HTTP-only cookies
* bcrypt password hashing

**Media Storage**

* Cloudinary

## 🏗️ Architecture

```text
                 ChatX Client
                 React + Vite
                      |
                REST API / Socket.IO
                      |
                 Node.js Server
                    Express
                      |
          ---------------------------
          |            |            |
       MongoDB      Socket.IO    Cloudinary
       Atlas        Real-time    Media Storage
          |
     User / Message /
     Conversation Data
```

## 🚀 Getting Started

### Prerequisites

* Node.js 24.x
* npm
* MongoDB Atlas account
* Cloudinary account

### 1. Clone the repository

```bash
git clone https://github.com/hasanraza8751/chatX.git

cd chatX
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

Create a `.env` file inside the server directory using `.env.example` as a reference.

Configure the required environment variables:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Install frontend dependencies

Open another terminal:

```bash
cd client
npm install
```

Create a `.env` file inside the client directory:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 4. Start the application

Start the backend using its configured start script.

```bash
cd server
npm start
```

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Open:

http://localhost:5173

## 🌍 Deployment

* Frontend: Vercel
* Backend: Render
* Database: MongoDB Atlas
* Media Storage: Cloudinary

## 🔐 Security

* Passwords are hashed using bcrypt.
* Authentication uses HTTP-only JWT cookies.
* Sensitive environment variables are kept server-side.
* Protected routes require authentication.
* Conversation access is restricted to participants.

Never commit real `.env` files or API credentials.

## 📸 Screenshots

Add application screenshots here as the project evolves.

## 👨‍💻 Author

**Md Hasan Raza**

GitHub: [@hasanraza8751](https://github.com/hasanraza8751)

---

Built with ❤️ while learning and exploring full-stack development.
