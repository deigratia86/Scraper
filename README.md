# Great Sage - Amazon Order Scraper

Chrome extension that scrapes your Amazon order history and exports it as CSV for import into Great Sage Finance Tracker.

## Features
- Scrapes orders from Amazon Order History pages
- **Per-item price extraction** from order listings and detail pages
- Per-item CSV rows with individual prices (v1.3.0+)
- Persistent scraping mode: navigate pages to collect across multiple pages
- Smart categorization (pet, health, groceries, entertainment, personal, household)
- Duplicate detection (by order ID)
- Skips refunded/returned orders
- Fetch missing item details and per-item prices from order detail pages
- Export as CSV (Finance Tracker format) or JSON
- Data stays local (no external servers)

## Installation
1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this folder (or the folder you cloned the repo into)

## Usage
1. Navigate to [Amazon Order History](https://www.amazon.com/gp/your-account/order-history)
2. Click the Great Sage extension icon in Chrome toolbar
3. Select time period and click "Start Scraping"
4. Navigate through order pages (scraping is persistent across page loads)
5. Click "Stop Scraping" when done
6. If orders show ⚠️, click "Fetch Missing Details" to get per-item prices
7. Export as CSV for use in your finance tracker (or import into [Great Sage](https://skillacquired.io))

## CSV Format (v1.3.0+)
| Column | Description |
|--------|------------|
| Date | Order date |
| Amount | Per-item price (or order total for single-item orders) |
| Description | Individual item name |
| Category | Smart-categorized (pet, health, groceries, etc.) |
| OrderID | Amazon order ID (shared across items in same order) |
| OrderTotal | Full order total including tax/shipping (for bank matching) |
| ItemCount | Number of items in the order |
| Items | JSON array of all items with names, prices, ASINs |
| Status | Delivery status |

Multi-item orders with per-item prices get one CSV row per item. Orders without per-item prices get a single row with the order total.

## File Structure
- `manifest.json` - Chrome extension manifest (v3)
- `scraper-core.js` - Shared parsing/categorization logic
- `popup.html` / `popup.js` - Extension popup UI
- `content.js` - Auto-scrape on page navigation
- `content.css` - Scraping indicator styles
- `icon-16/48/128.png` - Extension icons

## Version History
- **v1.3.0** (Mar 2026): Per-item CSV rows with individual prices, OrderTotal column for bank matching, improved price extraction from DOM and detail pages, expanded detail fetch for multi-item orders missing prices
- **v1.2.0** (Mar 2026): Code dedup via scraper-core.js, error handling, exponential backoff, DOM detection, a11y, icon redesign
- **v1.1.0**: Initial manifest v3, persistent scraping, smart categorization, detail fetch
