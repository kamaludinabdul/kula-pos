# KULA POS

Modern Point of Sales application built with React, Vite, Tailwind CSS, and Firebase.

## Features
- **Point of Sale (POS)**: Fast and intuitive checkout interface.
- **Stock Management**: Track inventory, stock opname, and adjustments.
- **Finance**: Cash Flow management (Income/Expense) and Profit & Loss reports.
- **Mobile Support**: Optimized layout for mobile and tablet devices.
- **Multi-Store**: Support for multiple store locations.

## Development

### Prerequisites
- Node.js (v18+)
- Firebase CLI (`npm install -g firebase-tools`)

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file (copy from `.env.example`).
4. Start development server:
   ```bash
   npm run dev
   ```

## Testing
Run the test suite using Vitest:
```bash
npm test
```
- **Unit Tests**: `src/utils/*.test.js`
- **Component Tests**: `src/components/**/*.test.jsx`

## Deployment

We use Firebase Hosting with two environments: **Staging** and **Production**.

### 1. Staging (Test Environment)
Use this for testing new features before releasing to real users.
- **URL**: [https://kula-pos-staging.web.app](https://kula-pos-staging.web.app)
- **Command**:
  ```bash
  npm run deploy:staging
  ```
  *This builds the app with `.env.staging` and deploys to the `kula-pos-staging` project.*

### 2. Production (Live Environment)
Use this for the live application used by customers.
- **URL**: [https://kula-pos.web.app](https://kula-pos.web.app)
- **Command**:
  ```bash
  npm run build
  firebase deploy
  ```
  *This builds the app with `.env.production` and deploys to the `kula-pos` project.*

## Project Structure
- `src/pages`: Application pages (POS, Reports, Settings, etc.)
- `src/components`: Reusable UI components.
- `src/context`: Global state management (Auth, Data, Shift).
- `src/firebase.js`: Firebase configuration.
