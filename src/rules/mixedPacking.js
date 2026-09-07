'use strict';

/**
 * mixedPacking.js — pakowanie razem (mixed packing).
 * Źródło: ADR 4.1.10.4, pole API: mixedPacking (kody MP1-MP24).
 * Opisy kodów MP są wciąż tekstowe, nie w pełni "maszynowe" — dla
 * jednoznacznych kodów (MP2/4/6 "nigdy", MP20-23 "tylko ten sam UN") funkcja
 * daje twardy werdykt, dla pozostałych zwraca oba opisy do interpretacji.
 */

const { loadData, getLang } = require('./dataLoader');

const KEYS = {
    pl: { codes: 'kody_MP' },
    en: { codes: 'mp_codes' }
};

function keysFor(lang) {
    return KEYS[lang] || KEYS.pl;
}

const NEVER_TOGETHER = ['MP2', 'MP4', 'MP6'];
const SAME_UN_ONLY = ['MP20', 'MP21', 'MP22', 'MP23'];

const MESSAGES = {
    pl: {
        forbidden: function (codes) { return 'Co najmniej jeden z kodów (' + codes + ') zasadniczo zabrania pakowania z czymkolwiek innym, poza wskazanymi w opisie wyjątkami — sprawdź "descriptions".'; },
        sameUnOk: 'Kod wymaga tego samego numeru UN — spełnione (sameUnNumber=true). Uwzględnij mimo to ewentualne wyjątki opisane w treści kodu (np. grupy zgodności C/D/E).',
        sameUnReview: function (a, b) { return 'Kod (' + a + ' / ' + b + ') dotyczy klasy 1 i wymaga zwykle tego samego numeru UN, z wąskimi, opisanymi tekstowo wyjątkami (grupy zgodności, środki inicjujące) — sprawdź opis w "descriptions" ręcznie.'; },
        sameCodeReview: 'Ten sam kod MP po obu stronach — zwykle dozwolone w ramach limitów z opisu (np. masy/objętości na opakowanie wewnętrzne), ale wciąż zależnie od dalszych warunków tekstowych — sprawdź "descriptions".',
        genericReview: 'Kody nie są jednoznacznie automatycznie rozstrzygalne — porównaj warunki tekstowe obu opisów w "descriptions" (limity na opakowanie wewnętrzne, dopuszczone/wykluczone klasy, warunek braku niebezpiecznej reakcji).'
    },
    en: {
        forbidden: function (codes) { return 'At least one of the codes (' + codes + ') generally forbids packing with anything else, except for the exceptions listed in its description — see "descriptions".'; },
        sameUnOk: 'The code requires the same UN number — satisfied (sameUnNumber=true). Still check the code text for exceptions (e.g. compatibility groups C/D/E).',
        sameUnReview: function (a, b) { return 'Code (' + a + ' / ' + b + ') concerns Class 1 and usually requires the same UN number, with narrow, text-described exceptions (compatibility groups, means of initiation) — check the description in "descriptions" manually.'; },
        sameCodeReview: 'Same MP code on both sides — usually allowed within the limits stated in the description (e.g. mass/volume per inner packaging), but still subject to further textual conditions — see "descriptions".',
        genericReview: 'The codes cannot be resolved automatically and unambiguously — compare the textual conditions of both descriptions in "descriptions" (limits per inner packaging, allowed/excluded classes, the no-dangerous-reaction condition).'
    }
};

/**
 * describeMixedPackingCode(code, lang)
 */
function describeMixedPackingCode(code, lang) {
    const data = loadData('mixedPacking');
    const K = keysFor(lang || getLang());
    const table = data[K.codes] || {};
    const clean = String(code || '').trim().toUpperCase();

    return {
        code: clean,
        found: Object.prototype.hasOwnProperty.call(table, clean),
        description: table[clean] || null
    };
}

/**
 * checkMixedPacking(codeA, codeB, sameUnNumber, lang)
 * sameUnNumber: bool — czy oba towary mają ten sam numer UN (istotne dla MP20-24)
 * Zwraca: { codeA, codeB, verdict: 'allowed'|'forbidden'|'needs_review', reason, descriptions }
 */
function checkMixedPacking(codeA, codeB, sameUnNumber, lang) {
    const resolvedLang = lang || getLang();
    const M = MESSAGES[resolvedLang] || MESSAGES.pl;
    const a = describeMixedPackingCode(codeA, resolvedLang);
    const b = describeMixedPackingCode(codeB, resolvedLang);

    const descriptions = { a: a, b: b };

    if (NEVER_TOGETHER.indexOf(a.code) !== -1 || NEVER_TOGETHER.indexOf(b.code) !== -1) {
        const codes = [a.code, b.code].filter(function (c) { return NEVER_TOGETHER.indexOf(c) !== -1; }).join(', ');
        return { codeA: a.code, codeB: b.code, verdict: 'forbidden', reason: M.forbidden(codes), descriptions: descriptions };
    }

    if (SAME_UN_ONLY.indexOf(a.code) !== -1 || SAME_UN_ONLY.indexOf(b.code) !== -1) {
        if (sameUnNumber === true) {
            return { codeA: a.code, codeB: b.code, verdict: 'allowed', reason: M.sameUnOk, descriptions: descriptions };
        }
        return { codeA: a.code, codeB: b.code, verdict: 'needs_review', reason: M.sameUnReview(a.code, b.code), descriptions: descriptions };
    }

    if (a.code === b.code && a.found) {
        return { codeA: a.code, codeB: b.code, verdict: 'needs_review', reason: M.sameCodeReview, descriptions: descriptions };
    }

    return { codeA: a.code, codeB: b.code, verdict: 'needs_review', reason: M.genericReview, descriptions: descriptions };
}

module.exports = { describeMixedPackingCode, checkMixedPacking };

if (require.main === module) {
    console.log(checkMixedPacking('MP15', 'MP19', false));
    console.log(checkMixedPacking('MP2', 'MP15', false));
    console.log(checkMixedPacking('MP20', 'MP20', true));
}
