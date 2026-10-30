// Deliberately small and explicit. This catches listed terms, not every form of abuse.
const BLOCKED_ARABIC_WORDS = new Set([
  'كس', 'كسم', 'كسمك', 'كسمه', 'كسمها', 'كسمهم',
  'زب', 'زبي', 'طيز', 'عرص', 'عرصة', 'عرصه', 'خول',
  'شرموط', 'شرموطة', 'شرموطه', 'قحبة', 'قحبه', 'قحاب',
  'شراميط', 'قحبات', 'عرصين', 'عرصات', 'خولات',
  'منيوك', 'منيوكين', 'متناك', 'متناكة', 'متناكه',
]);
const SAFE_ARABIC_PREFIXES = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'يا'];

const INVISIBLE_CHARACTERS = /[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufe00-\ufe0f]/gu;

export function normalizeArabicForContentFilter(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(/[\u0640]/gu, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/[ىی]/gu, 'ي')
    .replace(/ک/gu, 'ك')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .normalize('NFC')
    .toLocaleLowerCase('ar');
}

export function containsBlockedArabicWord(value) {
  const tokens = normalizeArabicForContentFilter(value).match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.some(token => BLOCKED_ARABIC_WORDS.has(token) || SAFE_ARABIC_PREFIXES.some(prefix =>
    token.startsWith(prefix) && BLOCKED_ARABIC_WORDS.has(token.slice(prefix.length))));
}
