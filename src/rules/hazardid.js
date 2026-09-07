'use strict';

/**
 * hazardId.js — numer rozpoznawczy zagrożenia (numer Kemlera).
 * Źródło: ADR 5.3.2.3, pole API: hazardId.
 * Zasadniczo lookup w tabeli — dla kodu spoza tabeli, przybliżony rozkład
 * cyfra-po-cyfrze z reguł ogólnych zamiast twardego błędu.
 */

const { loadData, getLang } = require('./dataLoader');

const KEYS = {
    pl: { general: 'reguly_ogolne', digitMeaning: 'znaczenie_cyfr', codes: 'kody' },
    en: { general: 'general_rules', digitMeaning: 'digit_meaning', codes: 'codes' }
};

function keysFor(lang) {
    return KEYS[lang] || KEYS.pl;
}

/**
 * decodeHazardId(code, lang)
 * Zwraca: { code, found, meaning, dangerousWithWater, guess?, digits? }
 */
function decodeHazardId(code, lang) {
    const data = loadData('hazardId');
    const resolvedLang = lang || getLang();
    const K = keysFor(resolvedLang);

    const cleanCode = String(code || '').trim().toUpperCase();
    const dangerousWithWater = cleanCode.startsWith('X');
    const numericPart = dangerousWithWater ? cleanCode.slice(1) : cleanCode;

    const table = data[K.codes] || {};

    if (Object.prototype.hasOwnProperty.call(table, cleanCode)) {
        return {
            code: cleanCode,
            found: true,
            meaning: table[cleanCode],
            dangerousWithWater: dangerousWithWater
        };
    }

    const digitMeaning = (data[K.general] && data[K.general][K.digitMeaning]) || {};
    const digits = numericPart.split('').map(function (d) {
        return { digit: d, meaning: digitMeaning[d] || null };
    });

    const note = (resolvedLang === 'en')
        ? 'Code not found directly in table 5.3.2.3.2 — the digit breakdown above is approximate. Verify against the official ADR text.'
        : 'Kod nie znaleziony wprost w tabeli 5.3.2.3.2 — powyższy rozkład na cyfry jest orientacyjny. Zweryfikuj w oficjalnym tekście ADR.';

    return {
        code: cleanCode,
        found: false,
        meaning: null,
        dangerousWithWater: dangerousWithWater,
        guess: true,
        digits: digits,
        note: note
    };
}

module.exports = { decodeHazardId };

if (require.main === module) {
    console.log(decodeHazardId('336'));
    console.log(decodeHazardId('X462'));
    console.log(decodeHazardId('999'));
}
