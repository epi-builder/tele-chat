# TeleChat - Real-time Messaging Application

## Overview

TeleChat is a modern, real-time messaging application built with React, Express, and PostgreSQL. It supports both direct messaging and group conversations with WebSocket-powered real-time communication. The application uses Replit's authentication system and features a clean, Telegram-inspired UI design.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Replit's OpenID Connect (OIDC) authentication
- **Real-time Communication**: WebSocket Server for live messaging
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple

### Database Layer
- **Primary Database**: PostgreSQL via Neon Database serverless
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management

## Key Components

### Authentication System
- **Provider**: Replit OIDC authentication
- **Session Storage**: PostgreSQL sessions table
- **User Management**: Automatic user creation and profile management
- **Authorization**: Route-level authentication middleware

### Real-time Messaging
- **Transport**: WebSocket connections with automatic reconnection
- **Message Types**: Text messages with sender information
- **Connection Management**: User-based connection tracking
- **Typing Indicators**: Real-time typing status (framework in place)

### Database Schema
- **Users**: Profile information (name, email, avatar)
- **Conversations**: Support for both direct (1:1) and group chats
- **Messages**: Text content with timestamps and sender references
- **Participants**: Many-to-many relationship between users and conversations
- **Sessions**: Authentication session storage

### UI Components
- **Chat Sidebar**: Conversation list with search functionality
- **Chat Area**: Message display with real-time updates
- **Message Bubbles**: Differentiated styling for sent/received messages
- **New Chat Dialog**: User search and conversation creation

## Data Flow

### Authentication Flow
1. User accesses application
2. Replit OIDC redirects to authentication provider
3. Successful auth creates/updates user record
4. Session established with PostgreSQL backing
5. Client receives user data and proceeds to main application

### Messaging Flow
1. User composes message in chat interface
2. Message sent via REST API to create database record
3. WebSocket broadcasts message to all conversation participants
4. Real-time UI updates for all connected clients
5. Message history loaded via REST API on conversation open

### Conversation Management
1. Users can search for other users by name/email
2. Direct conversations auto-created between two users
3. Group conversations support multiple participants
4. Conversation list shows latest message and timestamp

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React router
- **ws**: WebSocket implementation

### UI Dependencies
- **@radix-ui/***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Authentication Dependencies
- **openid-client**: OIDC authentication client
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

### Development Dependencies
- **vite**: Build tool and dev server
- **typescript**: Type safety and tooling
- **tsx**: TypeScript execution for development

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite development server with HMR
- **API Server**: Express server with hot reload via tsx
- **Database**: Neon PostgreSQL with connection pooling
- **WebSocket**: Integrated with Express server

### Production Build
- **Frontend**: Vite builds static assets to dist/public
- **Backend**: esbuild bundles server code to dist/index.js
- **Deployment**: Single Node.js process serving both API and static files
- **Environment**: Uses environment variables for database and session configuration

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **SESSION_SECRET**: Session encryption key (required)
- **REPL_ID**: Replit environment identifier
- **ISSUER_URL**: OIDC issuer URL (defaults to Replit)
- **REPLIT_DOMAINS**: Allowed domains for OIDC

## Changelog
```
Changelog:
- June 28, 2025. Initial setup
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```