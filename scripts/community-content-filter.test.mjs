import test from 'node:test';
import assert from 'node:assert/strict';
import { containsBlockedArabicWord, normalizeArabicForContentFilter } from '../functions/api/community/_content-filter.js';

test('blocks listed Arabic profanity as whole words with punctuation boundaries', () => {
  assert.equal(containsBlockedArabicWord('محطة زبالة جديدة'), false);
  assert.equal(containsBlockedArabicWord('الطريق عَرْص!'), true);
  assert.equal(containsBlockedArabicWord('العرص يرفضه الركاب'), true);
  assert.equal(containsBlockedArabicWord('ياعرص'), true);
  assert.equal(containsBlockedArabicWord('والشرموطة'), true);
  assert.equal(containsBlockedArabicWord('منیوک'), true);
  assert.equal(containsBlockedArabicWord('كُس'), true);
});

test('normalizes tatweel, invisible separators and Arabic letter variants', () => {
  assert.equal(containsBlockedArabicWord('كـس'), true);
  assert.equal(containsBlockedArabicWord('ك\u200bسمك'), true);
  assert.equal(containsBlockedArabicWord('قحبه'), true);
  assert.equal(normalizeArabicForContentFilter('إآٱىیك'), 'اااييك');
});

test('does not reject benign transit, place names and words containing blocked substrings', () => {
  for (const value of [
    'خط المترو إلى محطة أكتوبر عبر كفر الشيخ',
    'طريق مكسور بجوار سوق الكسكس',
    'الكسوف الليلي فوق القاهرة',
    'زبيب طازج في منطقة المعادي ومحطة أبو النمرس',
    'الزبالين في الحي القريب ومنطقة محطة مترو'
  ]) assert.equal(containsBlockedArabicWord(value), false, value);
});
