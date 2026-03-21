// Amazon Order Scraper - Popup Script
// Persists across page navigation - keeps scraping as you browse pages

let isScrapingActive = false;

// DOM Elements
const statusEl = document.getElementById('status');
const scrapeBtnEl = document.getElementById('scrapeBtn');
const statsSection = document.getElementById('statsSection');
const orderCountEl = document.getElementById('orderCount');
const totalSpentEl = document.getElementById('totalSpent');
const progressSection = document.getElementById('progressSection');
const progressText = document.getElementById('progressText');
const previewSection = document.getElementById('previewSection');
const exportSection = document.getElementById('exportSection');
const exportBtnEl = document.getElementById('exportBtn');
const copyBtnEl = document.getElementById('copyBtn');
const clearBtnEl = document.getElementById('clearBtn');
const exportFormatEl = document.getElementById('exportFormat');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load scraping state and orders
  const stored = await chrome.storage.local.get(['scrapedOrders', 'scrapingActive']);
  
  isScrapingActive = stored.scrapingActive || false;
  
  if (stored.scrapedOrders && stored.scrapedOrders.length > 0) {
    updateStats(stored.scrapedOrders);
    showExportOptions();
  }
  
  updateButtonState();
  checkCurrentTab();
});

// Check current tab
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const stored = await chrome.storage.local.get(['scrapedOrders', 'scrapingActive']);
    const orderCount = stored.scrapedOrders?.length || 0;
    
    if (tab && tab.url && tab.url.includes('amazon.com')) {
      if (tab.url.includes('order-history') || tab.url.includes('your-orders')) {
        if (stored.scrapingActive) {
          setStatus('success', `Scraping active! ${orderCount} orders collected. Navigate pages to add more.`);
        } else if (orderCount > 0) {
          setStatus('info', `${orderCount} orders saved. Start scraping to add more.`);
        } else {
          setStatus('success', 'Ready! Click Start to begin collecting orders.');
        }
        scrapeBtnEl.disabled = false;
      } else {
        setStatus('warning', 'Go to Your Orders page to scrape.');
        scrapeBtnEl.disabled = true;
      }
    } else {
      setStatus('info', 'Open Amazon Order History to begin.');
      scrapeBtnEl.disabled = true;
    }
  } catch (e) {
    console.error('Error checking tab:', e);
  }
}

// Status helper
function setStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

// Update statistics display
function updateStats(orders) {
  if (!orders || orders.length === 0) {
    statsSection.style.display = 'none';
    previewSection.style.display = 'none';
    document.getElementById('pendingSection').style.display = 'none';
    return;
  }
  
  statsSection.style.display = 'grid';
  orderCountEl.textContent = orders.length;
  
  const total = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  totalSpentEl.textContent = `$${total.toFixed(2)}`;
  
  // Check for orders needing detail fetch (no items OR multi-item with missing prices)
  const pendingOrders = orders.filter(o => 
    o.needsDetailFetch || 
    (o.items && o.items.length > 1 && o.items.some(i => i.price === null || i.price <= 0))
  );
  const pendingSection = document.getElementById('pendingSection');
  const pendingCountEl = document.getElementById('pendingCount');
  
  if (pendingOrders.length > 0) {
    pendingSection.style.display = 'block';
    pendingCountEl.textContent = pendingOrders.length;
  } else {
    pendingSection.style.display = 'none';
  }
  
  // Update preview - show most recent first
  previewSection.style.display = 'block';
  previewSection.innerHTML = orders.slice(-10).reverse().map(order => `
    <div class="order-item">
      <span class="order-date">${order.date}</span> - 
      <span class="order-amount">$${(order.total || 0).toFixed(2)}</span>
      ${order.needsDetailFetch ? '<span style="color: #fbbf24; font-size: 11px;"> ⚠️</span>' : ''}
      <div style="color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${order.items?.[0]?.name || 'Order #' + order.orderId}
      </div>
    </div>
  `).join('') + (orders.length > 10 ? `<div class="order-item" style="color: #888; text-align: center;">Showing last 10 of ${orders.length} orders</div>` : '');
}

// Update button state
function updateButtonState() {
  if (isScrapingActive) {
    scrapeBtnEl.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="6" width="12" height="12"/>
      </svg>
      Stop Scraping
    `;
    scrapeBtnEl.style.background = '#ef4444';
    progressSection.style.display = 'block';
    progressText.textContent = 'Active - navigate pages to collect more orders';
  } else {
    scrapeBtnEl.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      Start Scraping
    `;
    scrapeBtnEl.style.background = '#ff9900';
    progressSection.style.display = 'none';
  }
}

// Show export options
function showExportOptions() {
  exportSection.style.display = 'flex';
}

// Toggle scraping
scrapeBtnEl.addEventListener('click', async () => {
  isScrapingActive = !isScrapingActive;
  
  // Save state
  await chrome.storage.local.set({ scrapingActive: isScrapingActive });
  
  updateButtonState();
  
  if (isScrapingActive) {
    // Start scraping current page immediately
    await scrapeCurrentPage();
    setStatus('success', 'Scraping started! Navigate through pages to collect more orders.');
  } else {
    const stored = await chrome.storage.local.get(['scrapedOrders']);
    const count = stored.scrapedOrders?.length || 0;
    setStatus('info', `Scraping stopped. ${count} orders collected.`);
  }
});

// Scrape current page
async function scrapeCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || !tab.url.includes('amazon.com')) {
      return;
    }
    
    // Execute scraping script
    let results;
    try {
      // Inject shared core first, then call it
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scraper-core.js'] });
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => scrapeOrdersFromDOM(document)
      });
    } catch (scriptErr) {
      setStatus('error', 'Permission denied. Reload the Amazon page and try again.');
      return;
    }
    
    if (results && results[0] && results[0].result) {
      const newOrders = results[0].result;
      
      // Get existing orders
      const stored = await chrome.storage.local.get(['scrapedOrders']);
      const existingOrders = stored.scrapedOrders || [];
      
      // Merge, avoiding duplicates by order ID
      const existingIds = new Set(existingOrders.map(o => o.orderId));
      const uniqueNewOrders = newOrders.filter(o => !existingIds.has(o.orderId));
      
      const allOrders = [...existingOrders, ...uniqueNewOrders];
      
      // Save
      await chrome.storage.local.set({ scrapedOrders: allOrders });
      
      // Update UI
      updateStats(allOrders);
      showExportOptions();
      
      if (uniqueNewOrders.length > 0) {
        setStatus('success', `Added ${uniqueNewOrders.length} new orders! Total: ${allOrders.length}`);
      } else if (newOrders.length > 0) {
        setStatus('info', `Page already scraped. Total: ${allOrders.length} orders.`);
      }
    }
  } catch (e) {
    console.error('Scraping error:', e);
    setStatus('error', 'Error scraping: ' + e.message);
  }
}

// Clear all data
clearBtnEl.addEventListener('click', async () => {
  if (confirm('Clear all scraped orders? This cannot be undone.')) {
    await chrome.storage.local.set({ scrapedOrders: [], scrapingActive: false });
    isScrapingActive = false;
    updateButtonState();
    updateStats([]);
    exportSection.style.display = 'none';
    setStatus('info', 'All orders cleared. Ready to start fresh.');
  }
});

// Fetch missing details for orders without item info
document.getElementById('fetchDetailsBtn')?.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['scrapedOrders']);
  const orders = stored.scrapedOrders || [];
  // Include orders flagged for detail fetch OR multi-item orders missing per-item prices
  const pendingOrders = orders.filter(o => 
    (o.needsDetailFetch || (o.items && o.items.length > 1 && o.items.some(i => i.price === null || i.price <= 0)))
    && o.detailsUrl
  );
  
  if (pendingOrders.length === 0) {
    setStatus('info', 'No orders need detail fetching (or missing detail URLs).');
    return;
  }
  
  const btn = document.getElementById('fetchDetailsBtn');
  btn.disabled = true;
  btn.textContent = `Fetching 0/${pendingOrders.length}...`;
  
  let updated = 0;
  
  for (let i = 0; i < pendingOrders.length; i++) {
    const order = pendingOrders[i];
    btn.textContent = `Fetching ${i + 1}/${pendingOrders.length}...`;
    
    try {
      // Fetch details from order details page
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (url) => {
          try {
            const response = await fetch(url, { credentials: 'include' });
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const items = [];
            const seenItems = new Set();
            
            // Strategy 1: Shipment item blocks (most reliable on detail pages)
            const itemBlocks = doc.querySelectorAll('[class*="shipment"] [class*="item"], [class*="od-shipment"] .a-fixed-left-grid');
            itemBlocks.forEach(block => {
              const link = block.querySelector('a[href*="/gp/product/"], a[href*="/dp/"]');
              const name = link?.textContent?.trim();
              if (!name || name.length < 5 || name.length > 300 || seenItems.has(name)) return;
              seenItems.add(name);
              
              let price = null;
              // Look for price in .a-color-price or .a-price .a-offscreen
              const priceEl = block.querySelector('.a-color-price, .a-price .a-offscreen');
              if (priceEl) {
                const m = priceEl.textContent?.match(/\$\s*([\d,]+\.\d{2})/);
                if (m) price = parseFloat(m[1].replace(/,/g, ''));
              }
              // Fallback: any dollar amount in the item row
              if (price === null) {
                const allPrices = [...block.textContent.matchAll(/\$\s*([\d,]+\.\d{2})/g)]
                  .map(m => parseFloat(m[1].replace(/,/g, '')))
                  .filter(p => p > 0 && p < 5000);
                if (allPrices.length === 1) price = allPrices[0];
              }
              
              items.push({
                name,
                price,
                asin: link.href?.match(/\/(?:dp|product)\/([A-Z0-9]{10})/)?.[1] || null
              });
            });
            
            // Strategy 2: Fallback - walk up DOM from each product link to find prices
            if (items.length === 0) {
              const adPatterns = /\b(secured card|business card|amazon card|credit card|gift card|rewards|sign.?up|apply now)\b/i;
              doc.querySelectorAll('a[href*="/gp/product/"], a[href*="/dp/"]').forEach(link => {
                const name = link.textContent?.trim();
                if (!name || name.length < 5 || name.length > 300 || seenItems.has(name)) return;
                if (adPatterns.test(name)) return; // Skip Amazon promotional links
                seenItems.add(name);
                let price = null;
                const asin = link.href?.match(/\/(?:dp|product)\/([A-Z0-9]{10})/)?.[1] || null;

                // Walk up DOM ancestors looking for price elements
                let el = link;
                for (let lvl = 0; lvl < 6 && el && price === null; lvl++) {
                  el = el.parentElement;
                  if (!el) break;
                  const priceEl = el.querySelector('.a-color-price, .a-price .a-offscreen');
                  if (priceEl) {
                    const m = priceEl.textContent?.match(/\$\s*([\d,]+\.\d{2})/);
                    if (m) price = parseFloat(m[1].replace(/,/g, ''));
                  }
                  if (price === null) {
                    const rawPrices = [...el.textContent.matchAll(/\$\s*([\d,]+\.\d{2})/g)]
                      .map(m => parseFloat(m[1].replace(/,/g, '')))
                      .filter(p => p > 0 && p < 5000);
                    // Only use if exactly 1-2 prices found (avoids grabbing from too-wide context)
                    if (rawPrices.length >= 1 && rawPrices.length <= 2) price = rawPrices[0];
                  }
                }

                items.push({ name, price, asin });
              });
            }
            
            return items.length > 0 ? items : null;
          } catch (e) {
            return null;
          }
        },
        args: [order.detailsUrl]
      });
      
      if (results && results[0] && results[0].result) {
        // Update the order in our list
        const orderIndex = orders.findIndex(o => o.orderId === order.orderId);
        if (orderIndex >= 0) {
          orders[orderIndex].items = results[0].result;
          orders[orderIndex].needsDetailFetch = false;
          updated++;
        }
      }
    } catch (e) {
      console.error('Error fetching details for order:', order.orderId, e);
    }
    
    // Exponential backoff between requests
    var delay = Math.min(500 * Math.pow(1.5, i), 5000);
    await new Promise(r => setTimeout(r, delay));
  }
  
  // Save updated orders
  await chrome.storage.local.set({ scrapedOrders: orders });
  updateStats(orders);
  
  btn.disabled = false;
  btn.textContent = 'Fetch Missing Details';
  setStatus('success', `Updated ${updated} of ${pendingOrders.length} orders with item details.`);
});

// Export data
exportBtnEl.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['scrapedOrders']);
  const orders = stored.scrapedOrders || [];
  
  if (orders.length === 0) {
    setStatus('warning', 'No orders to export.');
    return;
  }
  
  const format = exportFormatEl.value;
  let content, filename, mimeType;
  
  if (format === 'csv') {
    content = generateCSV(orders);
    filename = `amazon-orders-${new Date().toISOString().split('T')[0]}.csv`;
    mimeType = 'text/csv';
  } else {
    content = JSON.stringify(orders, null, 2);
    filename = `amazon-orders-${new Date().toISOString().split('T')[0]}.json`;
    mimeType = 'application/json';
  }
  
  downloadFile(content, filename, mimeType);
  setStatus('success', `Exported ${orders.length} orders as ${format.toUpperCase()}`);
});

// Copy to clipboard
copyBtnEl.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['scrapedOrders']);
  const orders = stored.scrapedOrders || [];
  
  if (orders.length === 0) {
    setStatus('warning', 'No orders to copy.');
    return;
  }
  
  const format = exportFormatEl.value;
  const content = format === 'csv' ? generateCSV(orders) : JSON.stringify(orders, null, 2);
  
  try {
    await navigator.clipboard.writeText(content);
    setStatus('success', 'Copied to clipboard!');
  } catch (e) {
    setStatus('error', 'Failed to copy: ' + e.message);
  }
});

// Generate CSV format for Finance Tracker (uses shared smartCategorize from scraper-core.js)
// v1.3.0: Per-item rows with OrderTotal column for bank matching
function generateCSV(orders) {
  const headers = ['Date', 'Amount', 'Description', 'Category', 'OrderID', 'OrderTotal', 'ItemCount', 'Items', 'Status'];
  const rows = [headers.join(',')];
  
  orders.forEach(order => {
    const orderItems = order.items || [];
    const itemCount = orderItems.length;
    const orderTotal = order.total || 0;
    const itemsJson = JSON.stringify(orderItems).replace(/"/g, '""');
    const status = order.status || 'Unknown';
    
    // Determine if we can split into per-item rows
    const itemsWithPrices = orderItems.filter(i => i.price !== null && i.price > 0);
    const canSplitItems = itemCount > 1 && itemsWithPrices.length > 0;
    
    if (canSplitItems) {
      // Per-item rows: each item gets its own CSV row
      const pricedTotal = itemsWithPrices.reduce((s, i) => s + i.price, 0);
      const unpricedItems = orderItems.filter(i => i.price === null || i.price <= 0);
      const remainder = Math.max(0, orderTotal - pricedTotal);
      
      orderItems.forEach((item, idx) => {
        let amount;
        if (item.price !== null && item.price > 0) {
          amount = item.price;
        } else if (unpricedItems.length > 0 && remainder > 0) {
          // Distribute remainder evenly among unpriced items
          amount = Math.round((remainder / unpricedItems.length) * 100) / 100;
        } else {
          amount = 0;
        }
        
        const cleanDesc = (item.name || 'Amazon Item').replace(/"/g, '""').replace(/\n/g, ' ').substring(0, 200);
        const category = smartCategorize(item.name || '');
        
        rows.push([
          `"${order.date}"`,
          amount.toFixed(2),
          `"${cleanDesc}"`,
          category,
          order.orderId,
          orderTotal.toFixed(2),
          itemCount,
          `"${itemsJson}"`,
          `"${status}"`
        ].join(','));
      });
    } else {
      // Single row: either 1 item, or multi-item without any prices
      const allItemNames = orderItems.map(i => i.name).join(', ');
      const cleanDesc = (allItemNames || 'Amazon Purchase').replace(/"/g, '""').replace(/\n/g, ' ').substring(0, 200);
      const category = smartCategorize(allItemNames);
      
      rows.push([
        `"${order.date}"`,
        orderTotal.toFixed(2),
        `"${cleanDesc}"`,
        category,
        order.orderId,
        orderTotal.toFixed(2),
        itemCount,
        `"${itemsJson}"`,
        `"${status}"`
      ].join(','));
    }
  });
  
  return rows.join('\n');
}

// Download helper
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
