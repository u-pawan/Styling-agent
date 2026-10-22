import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorize, colorFamily, normalize } from '../src/catalog/normalize.js';
import { colorScore } from '../src/engine/colors.js';
import { guessOccasion } from '../src/engine/stylist.js';
import { styleTags } from '../src/catalog/enrich.js';

test('shoe type comes from the title before the tags', () => {
  assert.equal(categorize('Shoes', 'Beige Solid Sneakers', ['Formal Wear', 'Casual Shoes']), 'sneakers');
  assert.equal(categorize('Shoes', 'Dark Brown Oxford Shoes', ['Formal Shoes']), 'formal_shoes');
  assert.equal(categorize('Shoes', 'Slide-Easy White Sneaker Mules', ['Sneakers']), 'mules');
  assert.equal(categorize('Shoes', 'Classic Chelsea Boots', []), 'boots');
});

test('categories from Shopify product types', () => {
  assert.equal(categorize('T-Shirts', 'Geometric Jacquard Luxe Polo T-Shirt', ['Polo']), 'polo');
  assert.equal(categorize('Trousers', 'Relaxed Fit Pleated Chinos', []), 'chinos');
  assert.equal(categorize('Luggage', 'Cabin Trolley', []), null);
  assert.equal(categorize('Accessories', 'Black Toned Snake Chain', []), 'jewellery');
  assert.equal(categorize('Accessories', 'Graphic Print Full Length Socks', []), null);
});

test('colour names collapse into families', () => {
  assert.equal(colorFamily('Off White'), 'cream');
  assert.equal(colorFamily('Dark Brown'), 'brown');
  assert.equal(colorFamily('Navy Blue'), 'navy');
  assert.equal(colorFamily('Mauve'), 'pink');
  assert.equal(colorFamily('Khaki'), 'beige');
});

test('colour harmony', () => {
  assert.equal(colorScore('navy', 'beige'), 2);
  assert.equal(colorScore('red', 'red'), -2);
  assert.equal(colorScore('blue', 'blue'), -1);
  assert.equal(colorScore('pink', 'red'), -2);
  assert.ok(colorScore('olive', 'white') > 0);
});

test('occasion keywords', () => {
  assert.equal(guessOccasion("my cousin's sangeet next week"), 'festive');
  assert.equal(guessOccasion('client meeting on Monday'), 'office');
  assert.equal(guessOccasion('dinner with her'), 'date');
  assert.equal(guessOccasion('hello'), null);
});

test('merchandising noise is dropped from style tags', () => {
  assert.deepEqual(styleTags(['Bday_2026_50%', 'Model-David', 'Linen', 'MANGALAM COLOURS', 'Slim Fit', 'CG-301']), ['Linen', 'Slim Fit']);
});

test('normalize reads sizes, stock and occasion tags', () => {
  const p = normalize({
    id: 1, handle: 'h', title: 'Olive Slim Fit Shirt', product_type: 'Shirts', body_html: '<p>Nice</p>',
    tags: ['Smart Casuals', 'Olive', 'Slim Fit', 'Linen'],
    options: [{ name: 'Color', values: ['Olive'] }, { name: 'Size', values: ['M', 'L'] }],
    variants: [
      { id: 11, title: 'Olive / M', option1: 'Olive', option2: 'M', available: true, price: '1299.00', compare_at_price: '2499.00' },
      { id: 12, title: 'Olive / L', option1: 'Olive', option2: 'L', available: false, price: '1299.00', compare_at_price: null },
    ],
    images: [{ src: 'https://cdn.shopify.com/x.jpg' }],
  }, 'store');
  assert.equal(p.category, 'shirt');
  assert.equal(p.color_family, 'olive');
  assert.deepEqual(p.sizes.map((s) => [s.size, s.available]), [['M', true], ['L', false]]);
  assert.deepEqual(p.occasions.sort(), ['date', 'office']);
  assert.equal(p.fit, 'Slim Fit');
  assert.equal(p.price, 1299);
});
