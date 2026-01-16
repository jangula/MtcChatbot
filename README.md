# MTC Maris WhatsApp Chatbot

A WhatsApp Business chatbot solution for MTC Maris mobile wallet services in Namibia.

## Features

- **Airtime Purchase** - Buy airtime for self or others
- **Data Bundles** - Purchase Wizza Bazza, Mega Data, and other bundles
- **Money Transfer (P2P)** - Send money to other MTC Maris wallets
- **Bill Payments** - Pay electricity, water, DStv, and other utilities
- **Balance Inquiry** - Check wallet balance
- **Transaction History** - View recent transactions
- **Instant Loans** - Apply for micro-loans
- **Savings** - Manage savings pocket
- **Insurance** - Life, health, and legal cover

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   WhatsApp      │────▶│  Chatbot API     │────▶│  MTC Maris      │
│   Business API  │◀────│  (Node.js)       │◀────│  Core System    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   PostgreSQL     │
                        │   Database       │
                        └──────────────────┘
```

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis (optional, for session caching)
- WhatsApp Business API access (Meta Business verification required)

## Quick Start

### 1. Clone and Install

```bash
cd MTCChatbot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Set Up Database

```bash
# Create PostgreSQL database
createdb mtc_maris_chatbot

# Run migrations (tables are auto-created on startup)
npm start
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment (development/production) | No |
| `DB_HOST` | PostgreSQL host | Yes |
| `DB_NAME` | Database name | Yes |
| `DB_USER` | Database user | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID | Yes |
| `WHATSAPP_ACCESS_TOKEN` | Meta access token | Yes |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook verification token | Yes |
| `WHATSAPP_APP_SECRET` | App secret for signature verification | Yes |
| `MARIS_API_URL` | MTC Maris API endpoint | Yes* |
| `JWT_SECRET` | Secret for JWT tokens | Yes |
| `ENCRYPTION_KEY` | 32-char encryption key | Yes |

*In development mode, mock API is used if not provided.

## WhatsApp Business API Setup

### 1. Create Meta Business Account

1. Go to [Meta Business Suite](https://business.facebook.com)
2. Create a Business Account
3. Verify your business

### 2. Set Up WhatsApp Business API

1. Go to [Meta Developers](https://developers.facebook.com)
2. Create a new App (Business type)
3. Add WhatsApp product
4. Get your Phone Number ID and Access Token

### 3. Configure Webhook

1. In Meta Developers, go to WhatsApp > Configuration
2. Set Webhook URL: `https://your-domain.com/webhook`
3. Set Verify Token: Same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in .env
4. Subscribe to: `messages`

### 4. Register Phone Number

- Use a phone number not linked to any WhatsApp account
- Complete the verification process

## API Endpoints

### Webhook

- `GET /webhook` - Webhook verification (used by Meta)
- `POST /webhook` - Incoming messages

### Health

- `GET /health` - Health check
- `GET /` - Service info

### Admin (Basic Auth)

- `GET /admin/stats` - Dashboard statistics
- `GET /admin/users` - List users
- `GET /admin/transactions` - List transactions
- `GET /admin/audit-logs` - View audit logs

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── conversations/    # Chatbot conversation flows
│   ├── engine.js     # Main conversation engine
│   └── flows/        # Individual flow handlers
├── middleware/       # Express middleware
├── models/           # Sequelize models
├── routes/           # API routes
├── services/         # Business logic services
├── utils/            # Utility functions
├── whatsapp/         # WhatsApp API integration
├── maris-api/        # MTC Maris API client
└── index.js          # Application entry point
```

## Security Features

- TLS 1.2+ encryption for all communications
- AES-256 encryption for sensitive data at rest
- PIN + OTP authentication
- Session timeout (5 minutes)
- Rate limiting
- Webhook signature verification
- Audit logging

## Development

### Mock Mode

In development, the system uses mock MTC Maris API responses. Sample accounts:

- Phone: `264811234567`, PIN: `12345`
- Phone: `264815551234`, PIN: `54321`

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### Huawei Cloud (FusionCloud)

1. Provision VM or container service
2. Set up PostgreSQL instance
3. Configure networking and SSL
4. Deploy application
5. Configure Meta webhook URL

## Support Model (Per RFP)

- **L1**: FAQ, access issues - MTC Maris team
- **L2**: Configuration, integration issues - Joint
- **L3**: Platform defects, critical issues - Vendor

## License

Proprietary - MTC Namibia

## Contact

For technical support, contact the development team.
