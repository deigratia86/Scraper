// Amazon Order Scraper - Shared Core Logic
// Single source of truth for order parsing (used by both popup.js and content.js)

function scrapeOrdersFromDOM(rootElement) {
  const orders = [];
  const seenOrderIds = new Set();

  // Find order containers via multiple selectors
  const selectors = [
    '.order-card', '.a-box-group.order', '[data-testid="order-card"]',
    '.order-info', '.js-order-card', '[class*="order-card"]'
  ];

  let containers = [];
  for (const sel of selectors) {
    const found = (rootElement || document).querySelectorAll(sel);
    if (found.length > 0) { containers = [...found]; break; }
  }

  // Fallback: elements containing order IDs
  if (containers.length === 0) {
    (rootElement || document).querySelectorAll('.a-box-group, .a-box').forEach(el => {
      if (el.textContent.match(/\d{3}-\d{7}-\d{7}/) &&
          (el.textContent.toLowerCase().includes('order') || el.querySelector('a[href*="/dp/"]'))) {
        containers.push(el);
      }
    });
  }

  containers.forEach(container => {
    try {
      const text = container.textContent;
      const orderIdMatch = text.match(/(\d{3}-\d{7}-\d{7})/);
      const orderId = orderIdMatch?.[1];
      if (!orderId || seenOrderIds.has(orderId)) return;
      seenOrderIds.add(orderId);

      // Skip returned/refunded
      const statusEl = container.querySelector('.delivery-box__primary-text, [class*="delivery-status"], [class*="shipment-status"]');
      const statusText = statusEl?.textContent?.toLowerCase() || '';
      const lowerText = text.toLowerCase();
      if (statusText.includes('refunded') || statusText.includes('return complete') ||
          statusText.includes('return in progress') || lowerText.includes('your return is complete') ||
          lowerText.includes('your refund has been issued') || lowerText.includes('return complete')) {
        return;
      }

      // Date
      let date = 'Unknown';
      const datePatterns = [
        /(?:Order placed|Ordered on)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
        /(?:Order date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
        /([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/
      ];
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) { date = match[1].trim(); break; }
      }

      // Total
      let total = 0;
      const totalMatch = text.match(/(?:Order total|Grand total|Total)[:\s]*\$\s*([\d,]+\.\d{2})/i);
      if (totalMatch) {
        total = parseFloat(totalMatch[1].replace(/,/g, ''));
      } else {
        const prices = [...text.matchAll(/\$\s*([\d,]+\.\d{2})/g)]
          .map(m => parseFloat(m[1].replace(/,/g, '')))
          .filter(p => p > 0.50 && p < 10000);
        if (prices.length) total = Math.max(...prices);
      }

      // Items - extract per-item names and prices
      const items = [];
      const seenItems = new Set();

      // Strategy 1: Product links with nearby price extraction
      container.querySelectorAll('a[href*="/gp/product/"], a[href*="/dp/"]').forEach(link => {
        const name = link.textContent?.trim();
        if (name && name.length > 3 && name.length < 300 && !seenItems.has(name)) {
          seenItems.add(name);
          let price = null;
          const asin = link.href?.match(/\/(?:dp|product)\/([A-Z0-9]{10})/)?.[1] || null;

          // Walk up DOM to find price near this item
          const searchContexts = [
            link.closest('[class*="item"], [class*="product"], [class*="shipment"]'),
            link.closest('.a-row')?.parentElement,
            link.closest('.a-fixed-left-grid-col, .a-column'),
            link.parentElement?.parentElement?.parentElement
          ].filter(Boolean);

          for (const ctx of searchContexts) {
            if (price !== null) break;
            // Amazon .a-price .a-offscreen or .a-color-price patterns
            const priceEls = ctx.querySelectorAll('.a-price .a-offscreen, [class*="price"] .a-offscreen, .a-color-price');
            for (const el of priceEls) {
              const m = el.textContent?.match(/\$\s*([\d,]+\.\d{2})/);
              if (m) {
                const p = parseFloat(m[1].replace(/,/g, ''));
                if (p > 0 && p <= total) { price = p; break; }
              }
            }
            // Fallback: sole dollar amount in context block (not the order total)
            if (price === null) {
              const ctxPrices = [...ctx.textContent.matchAll(/\$\s*([\d,]+\.\d{2})/g)]
                .map(m => parseFloat(m[1].replace(/,/g, '')))
                .filter(p => p > 0 && p < total && p !== total);
              if (ctxPrices.length === 1) price = ctxPrices[0];
            }
          }

          items.push({ name, price, asin });
        }
      });

      // Fallback: item images with alt text (Grocery/Fresh)
      if (items.length === 0) {
        container.querySelectorAll('img[alt]:not([alt=""])').forEach(img => {
          const alt = img.alt?.trim();
          if (alt && alt.length > 10 && alt.length < 300 &&
              !alt.toLowerCase().includes('amazon') && !alt.toLowerCase().includes('logo') &&
              !seenItems.has(alt)) {
            seenItems.add(alt);
            items.push({ name: alt, price: null, asin: null });
          }
        });
      }

      // Determine if we need detail page fetch
      let detailsUrl = null;
      let needsDetailFetch = false;
      const detailsLink = container.querySelector('a[href*="order-details"], a[href*="gp/your-account/order-details"]');

      if (items.length === 0) {
        // No items at all
        if (detailsLink) { detailsUrl = detailsLink.href; needsDetailFetch = true; }
        items.push({ name: 'Amazon Purchase (details pending)', price: total, asin: null });
      } else if (items.length > 1 && items.some(i => i.price === null)) {
        // Multi-item order with missing per-item prices
        if (detailsLink) { detailsUrl = detailsLink.href; needsDetailFetch = true; }
      }

      // Status
      let status = 'Unknown';
      const statusPatterns = [/Delivered\s+[A-Za-z]+\s+\d+/i, /Arriving\s+[A-Za-z]+/i, /Shipped/i, /Refunded/i, /Cancelled/i];
      for (const p of statusPatterns) {
        const m = text.match(p);
        if (m) { status = m[0]; break; }
      }

      if (total > 0 || items.length > 0) {
        const order = { orderId, date, total, items, status };
        if (detailsUrl) order.detailsUrl = detailsUrl;
        if (needsDetailFetch) order.needsDetailFetch = true;
        orders.push(order);
      }
    } catch (e) {
      console.error('Error parsing order:', e);
    }
  });

  // DOM structure detection
  if (orders.length === 0 && document.querySelector('[class*="order"], [data-testid*="order"]')) {
    console.warn('Amazon Scraper: Order elements detected but parsing returned 0 results. Amazon may have changed their DOM structure.');
  }

  return orders;
}

// Smart categorization for CSV export
function smartCategorize(text) {
  const t = text.toLowerCase();
  if (/\b(purina|friskies|meow mix|iams|blue buffalo|pedigree|fancy feast|sheba|wellness|dog food|cat food|dog|cat|pet|puppy|kitten|treats|litter|kibble|aquarium|fish food|bird|hamster|leash|collar|chew|scratching|catnip|flea|tick|pet supplies|cat toy|dog toy)\b/.test(t)) return 'pet';
  if (/\b(vitamin|medicine|health|supplement|bandage|first aid|pain relief|allergy|pharmacy|tylenol|advil|ibuprofen|thermometer|blood pressure|glucose|medical|prescription|otc)\b/.test(t)) return 'health';
  if (/\b(subscribe|subscription|membership|prime|kindle unlimited|audible|renewal)\b/.test(t)) return 'subscriptions';
  if (/\b(grocery|snack|bread|milk|egg|meat|chicken|beef|pork|fruit|vegetable|cereal|rice|pasta|sauce|spice|coffee|tea|juice|water|soda|candy|chocolate|cookie|cracker|chip|nut|butter|cheese|yogurt|cream|flour|sugar|oil|vinegar|condiment|soup|canned|frozen|organic)\b/.test(t)) return 'groceries';
  if (/\b(game|video game|movie|book|novel|toy|puzzle|entertainment|playing cards|board game|dvd|blu-ray|console|controller|streaming|anime|manga)\b/.test(t)) return 'entertainment';
  if (/\b(shampoo|soap|toothpaste|toothbrush|razor|beauty|skincare|lotion|deodorant|makeup|cosmetic|hair|nail|perfume|cologne|hygiene|shirt|pants|dress|shoes|clothing|jacket|socks|underwear|jeans|sweater|coat|hat|gloves|scarf|belt|tie)\b/.test(t)) return 'personal';
  return 'household';
}
