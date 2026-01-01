# POS System Design Guidelines

## Design Approach
**Design System:** Material Design with professional dashboard conventions (inspired by Loyverse, Square POS)
**Rationale:** POS systems prioritize efficiency, clarity, and quick data comprehension. Material Design provides excellent data visualization patterns and consistent interaction models.

## Core Design Elements

### Typography
- **Primary Font:** Inter (Google Fonts)
- **Hierarchy:**
  - Page Titles: text-2xl font-semibold
  - Section Headers: text-lg font-medium
  - Body Text: text-base font-normal
  - Labels/Captions: text-sm font-medium
  - Numbers/Metrics: Use tabular-nums for alignment

### Layout System
**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 for consistency
- Component padding: p-4 to p-6
- Section spacing: gap-6 to gap-8
- Card spacing: p-6
- Sidebar width: w-64 (desktop), full-width drawer (mobile)

### Component Library

**Sidebar Navigation:**
- Fixed left sidebar (desktop), collapsible hamburger menu (mobile)
- Logo/brand at top with p-6
- Navigation items with py-3 px-4, rounded-lg hover states
- Active state: filled background with subtle shadow
- Icons from Heroicons (outline style) at size-6

**Dashboard Cards:**
- Rounded corners: rounded-xl
- Elevation: shadow-sm with subtle border
- Padding: p-6
- Header with icon + title, large metric number below
- Micro-trend indicators (↑ 12% from yesterday) in caption size

**Summary Metrics (Top of Dashboard):**
- Three-column grid (grid-cols-1 md:grid-cols-3 gap-6)
- Each card: Icon (size-8), Label, Large number (text-3xl font-bold), subtitle trend
- Icons: Currency (Sales), CreditCard (Credit), Package (Stock)

**Data Tables:**
- Striped rows for readability (bg-gray-50 alternating)
- Header: font-medium with border-b-2
- Cell padding: px-4 py-3
- Hover state on rows: bg-gray-100

**Buttons:**
- Primary: py-2 px-4, rounded-lg, font-medium
- Secondary: border-2, transparent background
- Icon buttons: rounded-lg, p-2

### Mobile Responsiveness
- Sidebar becomes slide-out drawer (transform translate-x)
- Metric cards stack to single column (grid-cols-1)
- Tables scroll horizontally with overflow-x-auto
- Touch-friendly tap targets: minimum h-12

### Visual Hierarchy
- Page container: max-w-7xl mx-auto px-4
- Dashboard grid: grid-cols-1 lg:grid-cols-3 for metrics, then full-width sections below
- Consistent section spacing: space-y-6 between major sections
- Low Stock Items: Table with product name, current stock (bold), reorder level

### Animations
**Minimal and Purposeful:**
- Sidebar slide: transition-transform duration-300
- Card hover lift: transition-shadow duration-200
- No scroll animations or complex effects

## Images
**No hero images needed.** This is a utility application focused on data display. All visuals come from icons and data visualization.

**Icons Usage:**
- Dashboard: ChartBarIcon, CurrencyDollarIcon, UserGroupIcon
- Sidebar: HomeIcon, ShoppingCartIcon, CubeIcon, UsersIcon, DocumentChartBarIcon
- All from Heroicons via CDN

## Page-Specific Layouts

**Dashboard Structure:**
1. Page header with title ("Dashboard") and date
2. Three metric cards in grid
3. Low Stock Items table (full-width card below metrics)
4. Adequate whitespace between sections (space-y-6)

**General Pattern:**
- Consistent header: Page title + action button (right-aligned)
- Content area with cards and tables
- Adequate padding throughout (p-6 on main content)