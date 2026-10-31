import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeMapText, safeMapColor } from './mapHtml.js';

test('map labels cannot create markup or escape quoted attributes', () => {
  assert.equal(escapeMapText('<img src=x onerror="alert(1)"> & \'القاهرة\''),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;القاهرة&#39;');
  assert.equal(escapeMapText('محطة &lt;مترو&gt;'), 'محطة &amp;lt;مترو&amp;gt;');
  assert.equal(escapeMapText(null), '');
  assert.equal(escapeMapText(3), '3');
});

test('route colors cannot introduce attributes or arbitrary CSS', () => {
  assert.equal(safeMapColor('#aB12ef'), '#aB12ef');
  assert.equal(safeMapColor('#fff'), '#fff');
  assert.equal(safeMapColor('red; background:url(https://example.com)'), '#15171C');
  assert.equal(safeMapColor('\" onmouseover=\"alert(1)'), '#15171C');
});
