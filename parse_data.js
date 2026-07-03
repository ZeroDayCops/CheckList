/**
 * Parser: extract checklist data from data.html into structured JS.
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/home/bittu/Desktop/ChecklistByZeroDayCops/data.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const emojiToDomain = {
  '🌐': { id: 'web', name: 'Web App', emoji: '🌐' },
  '🔌': { id: 'api', name: 'API', emoji: '🔌' },
  '🤖': { id: 'android', name: 'Android', emoji: '🤖' },
  '🍏': { id: 'ios', name: 'iOS', emoji: '🍏' },
  '🖥️': { id: 'thick-client', name: 'Thick Client', emoji: '🖥️' },
  '⛓️': { id: 'web3', name: 'Web3 / Smart Contracts', emoji: '⛓️' },
};

// Initialize domains
const domains = {};
for (const info of Object.values(emojiToDomain)) {
  domains[info.id] = { id: info.id, name: info.name, emoji: info.emoji, categories: [] };
}

const spaceDiv = doc.querySelector('.space-y-3');
const cards = spaceDiv.children;
let totalItems = 0;

for (let ci = 0; ci < cards.length; ci++) {
  const card = cards[ci];
  
  // First button is the header
  const headerBtn = card.querySelector('button');
  if (!headerBtn) continue;

  // Get emoji from the first span child of header button
  const firstSpan = headerBtn.querySelector('span');
  const emoji = firstSpan ? firstSpan.textContent.trim() : '';
  
  // Get category name from h3
  const h3 = card.querySelector('h3');
  const catName = h3 ? h3.textContent.trim() : `Category ${ci}`;
  
  // Determine domain
  const domainInfo = emojiToDomain[emoji];
  const domainId = domainInfo ? domainInfo.id : 'web';
  
  // Get all item li elements
  const listItems = card.querySelectorAll('ul li');
  const items = [];
  
  listItems.forEach((li, idx) => {
    // Inside li > button > span.flex-1 > span (the text)
    const btn = li.querySelector('button');
    if (!btn) return;
    const flexSpan = btn.querySelector('.flex-1');
    if (!flexSpan) return;
    const textSpan = flexSpan.querySelector('span');
    const title = textSpan ? textSpan.textContent.trim() : '';
    if (title) {
      items.push({
        id: `${domainId}-${ci}-${idx}`,
        title: title,
      });
      totalItems++;
    }
  });

  if (items.length > 0 && domains[domainId]) {
    domains[domainId].categories.push({
      id: `${domainId}-cat-${ci}`,
      name: catName,
      items: items,
    });
  }
}

const result = Object.values(domains).filter(d => d.categories.length > 0);

console.log('=== Parsed Data Summary ===');
result.forEach(d => {
  const itemCount = d.categories.reduce((sum, c) => sum + c.items.length, 0);
  console.log(`${d.emoji} ${d.name}: ${d.categories.length} categories, ${itemCount} items`);
});
console.log(`\nTotal: ${result.reduce((s,d) => s + d.categories.length, 0)} categories, ${totalItems} items`);

// Write as JS
const output = `/**\n * Checklist By ZeroDayCops — Parsed checklist data\n * Auto-generated from data.html. ${totalItems} items across ${result.reduce((s,d) => s + d.categories.length, 0)} categories.\n */\nconst CHECKLIST_DATA = ${JSON.stringify(result, null, 2)};\n`;
fs.writeFileSync('/home/bittu/Desktop/ChecklistByZeroDayCops/js/checklistData.js', output);
console.log('\n✅ Written to js/checklistData.js');
