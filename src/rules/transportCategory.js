'use strict';

/**
 * transportCategory.js — wyłączenie 1.1.3.6 (drobne ilości na jednostce transportowej).
 * Źródło: ADR 1.1.3.6, pole API: transportCategory.
 * Jedyne miejsce w silniku z prawdziwą matematyką — wynik zależy od
 * konkretnych ilości podanych w rozmowie, więc nie da się tego zapisać w JSON.
 *
 * Reguła (1.1.3.6.3-4): kategoria 0 -> wyłączenie nie ma zastosowania (limit 0);
 * kategoria 4 -> nie wlicza się do sumy; kategorie 1/2/3 -> mnożnik: kat.1 x 50
 * (kat.1 z przypisem "a" x 20), kat.2 x 3, kat.3 x 1 — suma <= 1000.
 */

const { loadData, getLang } = require('./dataLoader');

const KEYS = {
    pl: { categories: 'kategorie', limitField: 'limit_na_jednostke_transportowa' },
    en: { categories: 'categories', limitField: 'limit_per_transport_unit' }
};

const MULTIPLIERS = { '0': null, '1': 50, '2': 3, '3': 1, '4': 0 };

function keysFor(lang) {
    return KEYS[lang] || KEYS.pl;
}

const MESSAGES = {
    pl: {
        category0: 'Kategoria 0 — wyłączenie 1.1.3.6 nie ma zastosowania do całej jednostki transportowej.',
        category4: 'Kategoria 4 — nie wlicza się do sumy (bez ograniczeń).',
        unknownCategory: function (cat) { return 'Nieznana kategoria transportowa: "' + cat + '".'; },
        blocked: 'Co najmniej jedna pozycja jest w kategorii 0 — wyłączenie 1.1.3.6 nie ma zastosowania do całej jednostki transportowej, niezależnie od pozostałych ilości.',
        exempt: function (total) { return 'Suma (' + total + ') nie przekracza progu 1000 — jednostka transportowa może korzystać z wyłączenia 1.1.3.6.'; },
        notExempt: function (total) { return 'Suma (' + total + ') przekracza próg 1000 — pełny reżim ADR ma zastosowanie.'; }
    },
    en: {
        category0: 'Category 0 — the 1.1.3.6 exemption does not apply to the whole transport unit.',
        category4: 'Category 4 — not counted towards the total (unlimited).',
        unknownCategory: function (cat) { return 'Unknown transport category: "' + cat + '".'; },
        blocked: 'At least one entry is in category 0 — the 1.1.3.6 exemption does not apply to the whole transport unit, regardless of the other quantities.',
        exempt: function (total) { return 'The total (' + total + ') does not exceed the 1000 threshold — the transport unit may use the 1.1.3.6 exemption.'; },
        notExempt: function (total) { return 'The total (' + total + ') exceeds the 1000 threshold — full ADR requirements apply.'; }
    }
};

/**
 * calculate1136(items, lang)
 *
 * items: [{ unNumber, transportCategory: '0'..'4', quantity, footnoteA }]
 * footnoteA: true tylko dla UN-ów z przypisu "a" w kat.1 (limit 50 zamiast 20)
 *
 * Zwraca: { total, threshold: 1000, exempt, blockedByCategory0, breakdown }
 */
function calculate1136(items, lang) {
    const data = loadData('transportCategory_1_1_3_6');
    const resolvedLang = lang || getLang();
    const K = keysFor(resolvedLang);
    const M = MESSAGES[resolvedLang] || MESSAGES.pl;
    const categories = data[K.categories] || {};

    const list = Array.isArray(items) ? items : [];
    let total = 0;
    let blockedByCategory0 = false;

    const breakdown = list.map(function (item) {
        const cat = String(item.transportCategory).trim();
        const qty = Number(item.quantity) || 0;

        if (cat === '0') {
            blockedByCategory0 = true;
            return { unNumber: item.unNumber || null, category: cat, quantity: qty, contribution: null, note: M.category0 };
        }

        if (cat === '4') {
            return { unNumber: item.unNumber || null, category: cat, quantity: qty, contribution: 0, note: M.category4 };
        }

        let multiplier = MULTIPLIERS[cat];

        // Limit 50 zamiast 20 dla wybranych UN kat.1 -> mnożnik 1000/50 = 20 zamiast 1000/20 = 50.
        if (cat === '1' && item.footnoteA) {
            multiplier = 20;
        }

        if (multiplier === undefined || multiplier === null) {
            return { unNumber: item.unNumber || null, category: cat, quantity: qty, contribution: null, note: M.unknownCategory(cat) };
        }

        const contribution = qty * multiplier;
        total += contribution;

        return { unNumber: item.unNumber || null, category: cat, quantity: qty, multiplier: multiplier, contribution: contribution };
    });

    const exempt = !blockedByCategory0 && total <= 1000;

    return {
        total: total,
        threshold: 1000,
        exempt: exempt,
        blockedByCategory0: blockedByCategory0,
        breakdown: breakdown,
        categoryLimits: categories,
        note: blockedByCategory0 ? M.blocked : (exempt ? M.exempt(total) : M.notExempt(total))
    };
}

module.exports = { calculate1136 };

if (require.main === module) {
    console.log(calculate1136([
        { unNumber: '1098', transportCategory: '2', quantity: 100 },
        { unNumber: '1090', transportCategory: '3', quantity: 400 }
    ]));
}
