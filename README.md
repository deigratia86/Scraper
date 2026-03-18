# Great Sage - Amazon Order Scraper

Chrome extension that scrapes your Amazon order history and exports it as CSV for import into Great Sage Finance Tracker.

## Features
- Scrapes orders from Amazon Order History pages
- Persistent scraping mode: navigate pages to collect across multiple pages
- Smart categorization (pet, health, groceries, entertainment, personal, household)
- Duplicate detection (by order ID)
- Skips refunded/returned orders
- Fetch missing item details for Grocery/Fresh orders
- Export as CSV (Finance Tracker format) or JSON
- Data stays local (no external servers)

## Installation
1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `Scraper/` folder

## Usage
1. Navigate to [Amazon Order History](https://www.amazon.com/gp/your-account/order-history)
2. Click the Great Sage extension icon in Chrome toolbar
3. Select time period and click "Start Scraping"
4. Navigate through order pages (scraping is persistent across page loads)
5. Click "Stop Scraping" when done
6. Export as CSV and upload to Great Sage Finance Tracker

## File Structure
- `manifest.json` - Chrome extension manifest (v3)
- `scraper-core.js` - Shared parsing/categorization logic
- `popup.html` / `popup.js` - Extension popup UI
- `content.js` - Auto-scrape on page navigation
- `content.css` - Scraping indicator styles
- `icon.svg` - Extension icon (Rimuru with data brackets)

## Version History
- **v1.2.0** (Mar 2026): Code dedup via scraper-core.js, error handling, exponential backoff, DOM detection, a11y, icon redesign
- **v1.1.0**: Initial manifest v3, persistent scraping, smart categorization, detail fetch
