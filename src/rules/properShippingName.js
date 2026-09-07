'use strict';

/**
 * properShippingName.js — budowa prawidłowej nazwy przewozowej (PSN).
 * Źródło: ADR 3.2 / 5.4, plik danych: PSN.json.
 * Buduje bazowy zapis: "UN <numer> <NAZWA>, <klasa/nalepki>, <grupa pakowania>, (<kod tunelowy>)"
 * z pól zwracanych przez api.kocie.mba. Modyfikatory (ODPAD/GORĄCY/STABILIZOWANY
 * itd.) zależą od okoliczności transportu, których API nie zna — funkcja zwraca
 * ich pełną listę z warunkami, decyzję podejmuje asystent/użytkownik.
 */

const { loadData, getLang } = require('./dataLoader');

const KEYS = {
    pl: { modifiers: 'modyfikatory_dopisywane_do_nazwy' },
    en: { modifiers: 'name_modifiers' }
};

function keysFor(lang) {
    return KEYS[lang] || KEYS.pl;
}

/**
 * buildProperShippingName(record, lang)
 *
 * record: rekord zwrócony przez api.kocie.mba, np.:
 *   { unNumber:'1098', name:'ALKOHOL ALLILOWY', nameEn:'ALLYL ALCOHOL',
 *     hazardClass:'6.1', labels:'6.1 (3)', packingGroup:'I', tunnelCode:'C/D' }
 *
 * Zwraca: { plain: string, parts: {...}, availableModifiers: [...] }
 */
function buildProperShippingName(record, lang) {
    const rec = record || {};
    const resolvedLang = lang || getLang();
    const nameField = (resolvedLang === 'en') ? (rec.nameEn || rec.name) : (rec.name || rec.nameEn);

    const un = rec.unNumber ? 'UN ' + rec.unNumber : null;
    const name = nameField ? String(nameField).toUpperCase() : null;

    const hazardPart = (rec.hazardClass === '1' && rec.classificationCode)
        ? rec.classificationCode
        : (rec.labels || rec.hazardClass || null);

    const packingGroupPart = rec.packingGroup ? 'GP ' + rec.packingGroup : null;
    const tunnelPart = rec.tunnelCode ? '(' + rec.tunnelCode + ')' : null;

    const segments = [un, name].filter(Boolean).join(' ');
    const rest = [hazardPart, packingGroupPart].filter(Boolean).join(', ');
    const tail = tunnelPart ? ', ' + tunnelPart : '';

    const plain = [segments, rest].filter(Boolean).join(', ') + tail;

    const data = loadData('PSN');
    const K = keysFor(resolvedLang);
    const modifiersTable = data[K.modifiers] || {};
    const availableModifiers = Object.keys(modifiersTable)
        .filter(function (key) { return key.charAt(0) !== '_'; })
        .map(function (key) {
            return { modifier: key, condition: modifiersTable[key] };
        });

    return {
        plain: plain,
        parts: {
            unNumber: rec.unNumber || null,
            name: name,
            hazardPart: hazardPart,
            packingGroup: rec.packingGroup || null,
            tunnelCode: rec.tunnelCode || null
        },
        availableModifiers: availableModifiers,
        note: (resolvedLang === 'en')
            ? 'Base name built solely from API fields. Modifiers (WASTE, ELEVATED TEMPERATURE, STABILIZED, etc.) need to be added manually based on context — see "availableModifiers" and each one\'s condition.'
            : 'Bazowa nazwa zbudowana wyłącznie z pól API. Modyfikatory (ODPAD, GORĄCY, STABILIZOWANY itd.) trzeba dopisać ręcznie/kontekstowo — sprawdź "availableModifiers" i warunek każdego z nich.'
    };
}

module.exports = { buildProperShippingName };

if (require.main === module) {
    console.log(buildProperShippingName({
        unNumber: '1098',
        name: 'Alkohol allilowy',
        nameEn: 'Allyl alcohol',
        hazardClass: '6.1',
        labels: '6.1 (3)',
        packingGroup: 'I',
        tunnelCode: 'C/D'
    }));
}
