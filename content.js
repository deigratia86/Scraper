// Amazon Order Scraper - Content Script
// Auto-scrapes orders when scraping mode is active
// Uses scrapeOrdersFromDOM() from scraper-core.js (injected via manifest)

(function() {
  if (window.amazonScraperInjected) return;
  window.amazonScraperInjected = true;
  
  console.log('Amazon Order Scraper: Content script loaded');
  
  async function checkAndScrape() {
    try {
      const stored = await chrome.storage.local.get(['scrapingActive', 'scrapedOrders']);
      
      if (stored.scrapingActive) {
        showIndicator('Scraping this page...', '#22c55e');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Use shared core function
        const orders = scrapeOrdersFromDOM(document);
        
        if (orders.length > 0) {
          const existingOrders = stored.scrapedOrders || [];
          const existingIds = new Set(existingOrders.map(o => o.orderId));
          const newOrders = orders.filter(o => !existingIds.has(o.orderId));
          const allOrders = [...existingOrders, ...newOrders];
          
          await chrome.storage.local.set({ scrapedOrders: allOrders });
          
          if (newOrders.length > 0) {
            showIndicator('+' + newOrders.length + ' orders (' + allOrders.length + ' total)', '#22c55e');
          } else {
            showIndicator('Page already scraped (' + allOrders.length + ' total)', '#eab308');
          }
        } else {
          showIndicator('No orders found on this page', '#eab308');
        }
      }
    } catch (e) {
      console.error('Auto-scrape error:', e);
    }
  }
  
  function showIndicator(message, color) {
    let indicator = document.getElementById('amazon-scraper-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'amazon-scraper-indicator';
      document.body.appendChild(indicator);
    }
    
    indicator.innerHTML = '<div style="' +
      'position: fixed; bottom: 20px; right: 20px; background: ' + color + '; color: #000; ' +
      'padding: 12px 18px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; ' +
      'font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 99999; ' +
      'display: flex; align-items: center; gap: 8px;">' +
      '\uD83D\uDCE6 ' + message + '</div>';
    
    setTimeout(() => {
      indicator.style.transition = 'opacity 0.5s ease';
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 500);
    }, 3000);
  }
  
  if (document.readyState === 'complete') {
    checkAndScrape();
  } else {
    window.addEventListener('load', checkAndScrape);
  }
  
  // Re-scrape on AJAX navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(checkAndScrape, 2000);
    }
  }).observe(document, { subtree: true, childList: true });
})();
