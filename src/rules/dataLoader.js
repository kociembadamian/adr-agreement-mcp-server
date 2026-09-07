'use strict';

/**
 * dataLoader.js
 * Wspólny loader plików referencyjnych JSON (data/pl/*.json, data/en/*.json).
 * Język: zmienna środowiskowa ADR_DATA_LANG (patrz .env.example), domyślnie "pl".
 * Brak pliku w wybranym języku -> fallback na wersję polską.
 */

const fs = require('fs');
const path = require('path');

// dataLoader.js mieszka pod src/rules/, a data/ jest w korzeniu repo —
// więc dwa poziomy w górę: src/rules/ -> src/ -> korzeń repo -> data/.
const DATA_ROOT = path.join(__dirname, '..', '..', 'data');
const cache = new Map();

function getLang() {
    const lang = (process.env.ADR_DATA_LANG || 'pl').trim().toLowerCase();
    return (lang === 'en') ? 'en' : 'pl';
}

/**
 * loadData('hazardId') -> zawartość data/pl/hazardId.json (albo data/en/).
 */
function loadData(fileName) {
    const lang = getLang();
    const cacheKey = lang + ':' + fileName;

    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    let filePath = path.join(DATA_ROOT, lang, fileName + '.json');

    if (!fs.existsSync(filePath)) {
        filePath = path.join(DATA_ROOT, 'pl', fileName + '.json');
    }

    if (!fs.existsSync(filePath)) {
        const message = (lang === 'en')
            ? 'Missing reference file: ' + fileName + '.json (looked in data/' + lang + '/ and data/pl/)'
            : 'Brak pliku referencyjnego: ' + fileName + '.json (szukano w data/' + lang + '/ i data/pl/)';
        throw new Error(message);
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    cache.set(cacheKey, parsed);
    return parsed;
}

module.exports = { loadData, getLang };
