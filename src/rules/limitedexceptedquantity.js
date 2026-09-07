'use strict';

/**
 * limitedExceptedQuantity.js — ilości ograniczone (LQ) i wyłączone (EQ).
 * Źródło: ADR dział 3.4 (LQ) i 3.5 (EQ), pola API: limitedQuantity, exceptedQuantity.
 * Klucze "limitedQuantity_LQ" i "exceptedQuantity_EQ" są identyczne w obu
 * wersjach językowych danych, więc nie potrzeba tu mapy kluczy per język.
 */

const { loadData, getLang } = require('./dataLoader');

/**
 * resolveLimitedQuantity(limitedQuantityField, lang)
 * limitedQuantityField: wartość pola API "limitedQuantity", np. "100 ml" albo "0"
 */
function resolveLimitedQuantity(limitedQuantityField, lang) {
    const resolvedLang = lang || getLang();
    const value = (limitedQuantityField === undefined || limitedQuantityField === null)
        ? null
        : String(limitedQuantityField).trim();

    const permitted = value !== null && value !== '0' && value !== '';

    const note = (resolvedLang === 'en')
        ? (permitted
            ? 'Maximum net quantity per inner packaging/article: ' + value + '.'
            : 'Not permitted for carriage in Limited Quantities (LQ).')
        : (permitted
            ? 'Maksymalna ilość netto na opakowanie wewnętrzne/przedmiot: ' + value + '.'
            : 'Towar niedopuszczony do przewozu w ilościach ograniczonych (LQ).');

    return { raw: value, permitted: permitted, note: note };
}

/**
 * resolveExceptedQuantity(exceptedQuantityCode, lang)
 * exceptedQuantityCode: kod z pola API "exceptedQuantity", np. "E4"
 */
function resolveExceptedQuantity(exceptedQuantityCode, lang) {
    const resolvedLang = lang || getLang();
    const data = loadData('limitedQuantity_exceptedQuantity');
    const table = (data.exceptedQuantity_EQ && data.exceptedQuantity_EQ.tabela)
        || (data.exceptedQuantity_EQ && data.exceptedQuantity_EQ.table)
        || {};

    const code = String(exceptedQuantityCode || '').trim().toUpperCase();
    const entry = table[code];

    if (!entry) {
        const note = (resolvedLang === 'en') ? 'Unknown EQ code: "' + code + '".' : 'Nieznany kod EQ: "' + code + '".';
        return { code: code, found: false, permitted: false, note: note };
    }

    if (code === 'E0') {
        const note = (resolvedLang === 'en')
            ? 'E0 — not permitted as an Excepted Quantity.'
            : 'E0 — niedopuszczony jako ilość wyłączona.';
        return { code: code, found: true, permitted: false, note: note };
    }

    return { code: code, found: true, permitted: true, limits: entry };
}

/**
 * resolveLQEQ(record, lang) — skrót łączący oba pola z jednego rekordu API.
 */
function resolveLQEQ(record, lang) {
    const rec = record || {};
    return {
        limitedQuantity: resolveLimitedQuantity(rec.limitedQuantity, lang),
        exceptedQuantity: resolveExceptedQuantity(rec.exceptedQuantity, lang)
    };
}

module.exports = { resolveLimitedQuantity, resolveExceptedQuantity, resolveLQEQ };

if (require.main === module) {
    console.log(resolveLQEQ({ limitedQuantity: '100 ml', exceptedQuantity: 'E4' }));
    console.log(resolveLQEQ({ limitedQuantity: '0', exceptedQuantity: 'E0' }));
}
