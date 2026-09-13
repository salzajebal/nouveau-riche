# 증권플러스 비상장 주식관리 시스템

## Overview
A securities platform for Korean unlisted stocks (비상장주식), branded as 증권플러스 비상장, matching the design and structure of ustockplus.com. Features stock rankings, IPO calendar, news, expert reports, theme-based stocks, discussion forums, and tips sections. Members can register, login, and view their stock transaction history. Administrators can manage members and process stock in/out (입고/출고) transactions.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + wouter routing
- **Backend**: Express.js with session-based auth (bcrypt password hashing)
- **Database**: PostgreSQL with Drizzle ORM
- **Sessions**: connect-pg-simple for PostgreSQL session storage

## Brand Colors
- Primary: #E8344E (red/coral)
- Text: #222 (headings), #666 (secondary)
- Borders: #eee, #f5f5f5
- Price up: red (#f04452), Price down: blue (#3182f6)

## Key Pages
- `/` - Main landing page with 증권플러스 비상장 design: stock rankings table (10 unlisted companies with real-time price fluctuation), IPO calendar sidebar, news section (Google RSS), expert reports, theme stocks, discussions, tips
- `/home` - Promotional page (증권플러스 branding, hero sections, CTAs)
- `/login` - User login with transfer request panel
- `/register` - User registration
- `/dashboard` - User dashboard showing stock holdings and transaction history
- `/chat` - 1:1 customer service chat (WebSocket)
- `/admin` - Admin panel (login: admin / admin123)

## Admin Features
- 회원정보열람, 회원정보변경, 회원동결/해제, 회원삭제
- 입고/출고 처리 (configurable stock name for unlisted stocks)
- 입고량 수정, 대체출고 관리, 1:1 상담
- 종목 관리: IPO 청약 종목 추가/수정/삭제, 활성/비활성 관리, 청약진행중/청약예정 상태 관리
- 국내 주식 종목 검색 (140+ Korean stocks searchable for activation)

## Stock Categories (비상장)
- 일반, 공모주, 스팩, 장외, 기타

## Database Schema
- `users` - Members with bank info, admin flag, isFrozen flag
- `stock_transactions` - Stock in/out records per user with category, quantity, price
- `transfer_requests` - Transfer-out requests with status, default stockName "비상장주식"
- `chat_rooms` - 1:1 chat rooms per user
- `chat_messages` - Chat messages with roomId, senderId, senderRole
- `ipo_stocks` - IPO stocks with stockName, startDate, endDate, brokers, priceMin, priceMax, competitionRate, status (active/inactive), subscriptionStatus (청약진행중/청약예정)
- `session` - Express sessions

## API Routes
- Auth: POST /api/auth/register, /api/auth/login, /api/auth/logout, GET /api/auth/me
- User: GET /api/transactions/my, POST /api/transfer-requests, GET /api/transfer-requests/my
- Admin: CRUD on /api/admin/users, /api/admin/transactions, /api/admin/transfer-requests, /api/admin/ipo-stocks
- Public: GET /api/ipo-stocks (active IPO stocks for landing page)
- Chat: /api/chat/rooms, WebSocket /ws/chat
- Stock: GET /api/stocks/news (Korean unlisted stock news from Google RSS with caching)

## Running
`npm run dev` starts both frontend (Vite) and backend (Express) on port 5000.
