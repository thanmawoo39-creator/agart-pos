# QuickPOS - Point of Sale System

## Overview

QuickPOS is a web-based Point of Sale (POS) system designed for small businesses to manage sales, inventory, customers, and credit transactions. The application follows a professional dashboard design inspired by Loyverse and Square POS, prioritizing efficiency, clarity, and quick data comprehension.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state management and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens defined in CSS variables
- **Design System**: Material Design principles with professional dashboard conventions

The frontend follows a standard React SPA pattern with pages organized under `client/src/pages/` and reusable components in `client/src/components/`. The application uses a sidebar navigation pattern with routes for Dashboard, Sales (POS), Products, Customers, and Reports.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful JSON API with routes prefixed by `/api/`
- **Build**: esbuild for server bundling, Vite for client bundling

The server handles API routes in `server/routes.ts` and uses a storage abstraction layer in `server/storage.ts` that implements the `IStorage` interface for data operations.

### Data Storage
- **Primary Storage**: Replit Database (key-value store) via `@replit/database` package
- **Schema Definition**: Zod schemas in `shared/schema.ts` for runtime validation
- **Database Config**: Drizzle ORM configuration exists for PostgreSQL migration capability

The current implementation uses Replit's key-value database with collection-based storage (products, customers, sales, creditLedger). The schema includes Product, Customer, Sale, SaleItem, CreditLedger, and DashboardSummary types.

### Key Design Decisions

**Shared Schema Pattern**: Zod schemas are defined in `shared/schema.ts` and used by both frontend and backend, ensuring type consistency across the stack.

**Storage Abstraction**: The `IStorage` interface in `server/storage.ts` abstracts data operations, making it easier to swap storage backends (e.g., migrating from Replit Database to PostgreSQL).

**Component Library**: Using shadcn/ui provides accessible, customizable components while maintaining a consistent design language. Components are copied into the project (not imported from npm) for full customization control.

**Light/Dark Mode**: Theme toggle implemented with CSS variables and localStorage persistence.

### Clean Code Architecture

**POS Engine** (`server/lib/pos-engine.ts`): Domain-driven logic for sales processing with:
- `findProductByBarcode()` / `findCustomerByBarcode()` - Barcode scanning
- `processSale()` - Atomic stock updates and credit ledger entries
- `addCustomerPayment()` - Credit payment processing
- `POSError` class for domain-specific errors

**AI Insights Engine** (`server/lib/ai-engine.ts`): Business intelligence module with:
- `analyzeCustomerRisk(customerId)` - Risk analysis (High Risk if no payment 30+ days OR 90%+ credit utilization)
- `getTopDebtors(limit)` - Top N customers by outstanding balance
- `getStockWarnings()` - Predictive stock alerts based on sales velocity
- `getDailySummary()` - Cash vs Credit vs Card breakdown
- `getAIInsights()` - Aggregated insights for dashboard
- `getAllCustomerRiskAnalysis()` - Full customer risk report

### API Endpoints

**AI Insights**:
- `GET /api/ai/insights` - Dashboard AI insights (top debtors, stock warnings, daily summary)
- `GET /api/ai/risk-analysis` - All customer risk analyses
- `GET /api/ai/risk-analysis/:customerId` - Single customer risk analysis

**Credit Management**:
- `GET /api/customers/:id/ledger` - Customer's credit ledger entries
- `POST /api/customers/:id/payment` - Add payment to customer account

**Staff Management**:
- `GET /api/staff` - List all staff members (PINs not exposed)
- `POST /api/staff` - Create new staff member
- `PATCH /api/staff/:id` - Update staff member
- `DELETE /api/staff/:id` - Delete staff member
- `POST /api/auth/login` - Authenticate via PIN or barcode

### Staff Management & Authentication

**Staff Schema**: `server/lib/db.ts` and `shared/schema.ts`
- id, name, pin (4-digit), role (owner/manager/cashier), barcode, status (active/suspended)

**Auth Context** (`client/src/lib/auth-context.tsx`):
- Session management with localStorage persistence
- Role checking: `isOwner`, `isManager`, `isCashier`
- Hierarchical `canAccess('role')` function

**Default Staff Credentials**:
- Owner: PIN 1234 (STAFF001)
- Manager: PIN 2345 (STAFF002)
- Cashier: PIN 3456 (STAFF003)

**Role-Based UI Permissions**:
- Owner: Full access (Dashboard, Sales, Products, Customers, Ledger, Reports, Staff)
- Manager: Dashboard, Sales, Products, Customers, Ledger, Reports (no Staff page)
- Cashier: Sales, Products, Customers (limited ledger view)

**Audit Trail**:
- All sales and credit ledger entries include `createdBy` field
- Tracks which staff member performed each transaction

**Security Note (MVP)**:
- Current implementation uses plain-text PINs and client-side role checks
- For production: implement PIN hashing, server-side role enforcement, rate limiting

## External Dependencies

### Core Services
- **Replit Database**: Primary data persistence using `@replit/database` package for key-value storage
- **PostgreSQL** (configured but not active): Drizzle ORM setup exists in `drizzle.config.ts` for potential database migration

### Frontend Libraries
- **Radix UI**: Headless UI primitives for accessible components (dialog, dropdown, select, etc.)
- **TanStack React Query**: Server state management and data caching
- **Lucide React**: Icon library
- **date-fns**: Date manipulation utilities
- **class-variance-authority**: Component variant management
- **Recharts**: Chart components for data visualization

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development
- **Tailwind CSS**: Utility-first CSS framework

### Validation
- **Zod**: Runtime schema validation used throughout the application
- **drizzle-zod**: Integration between Drizzle ORM and Zod schemas