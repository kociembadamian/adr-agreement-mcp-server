'use strict';

/**
 * tankCode.js — dekodowanie kodu cysterny ADR (np. "L4BH").
 * Źródło: ADR 4.3.3/4.3.4, pole API: adrTankCode.
 * Kod = 4 części w stałej kolejności: typ (L/S), ciśnienie obliczeniowe
 * (G albo liczba), otwory (A-D), zawory/urządzenia (V/F/N/H).
 * Nie odtwarza pełnych tabel "zastosowania racjonalnego" (pominięte w danych
 * źródłowych jako zbyt obszerne) — dekoduje pojedynczy kod i sprawdza regułę
 * hierarchii 4.3.3 (czy jedna cysterna może zastąpić inną).
 */

const { loadData, getLang } = require('./dataLoader');

const KEYS = {
    pl: {
        structure: 'budowa_kodu',
        part1: 'czesc_1_typ',
        part2: 'czesc_2_cisnienie_obliczeniowe',
        part3: 'czesc_3_otwory',
        part4: 'czesc_4_zawory_urzadzenia_bezpieczenstwa',
        hierarchy: 'hierarchia_cystern',
        partNames: ['typ', 'ciśnienie', 'otwory', 'zawory/urządzenia']
    },
    en: {
        structure: 'code_structure',
        part1: 'part_1_type',
        part2: 'part_2_calculation_pressure',
        part3: 'part_3_openings',
        part4: 'part_4_valves_safety_equipment',
        hierarchy: 'tank_hierarchy',
        partNames: ['type', 'pressure', 'openings', 'valves/safety equipment']
    }
};

const HIERARCHY = {
    part1: ['S', 'L'],
    part2: ['G', '1.5', '2.65', '4', '10', '15', '21'],
    part3: ['A', 'B', 'C', 'D'],
    part4: ['V', 'F', 'N', 'H']
};

function keysFor(lang) {
    return KEYS[lang] || KEYS.pl;
}

/**
 * Rozbija kod cysterny na 4 części: <L/S><ciśnienie><A-D><V/F/N/H>.
 */
function splitTankCode(code) {
    const clean = String(code || '').trim().toUpperCase().replace(',', '.');
    const match = clean.match(/^([SL])(G|\d+(?:\.\d+)?)([ABCD])([VFNH])$/);
    if (!match) {
        return null;
    }
    return { type: match[1], pressure: match[2], openings: match[3], safety: match[4] };
}

/**
 * decodeTankCode(code, lang)
 * Zwraca: { code, valid, parts: { type, pressure, openings, safety } }
 */
function decodeTankCode(code, lang) {
    const data = loadData('adrTankCode');
    const resolvedLang = lang || getLang();
    const K = keysFor(resolvedLang);
    const structure = data[K.structure] || {};
    const parsed = splitTankCode(code);

    if (!parsed) {
        const note = (resolvedLang === 'en')
            ? 'Code does not match the <L/S><pressure><A-D><V/F/N/H> pattern, e.g. "L4BH".'
            : 'Kod nie pasuje do wzorca <L/S><ciśnienie><A-D><V/F/N/H>, np. "L4BH".';
        return { code: String(code || '').trim(), valid: false, note: note };
    }

    const table1 = structure[K.part1] || {};
    const table2 = structure[K.part2] || {};
    const table3 = structure[K.part3] || {};
    const table4 = structure[K.part4] || {};

    return {
        code: parsed.type + parsed.pressure + parsed.openings + parsed.safety,
        valid: true,
        parts: {
            type: { value: parsed.type, meaning: table1[parsed.type] || null },
            pressure: {
                value: parsed.pressure,
                meaning: (parsed.pressure === 'G')
                    ? table2.G
                    : (resolvedLang === 'en'
                        ? 'minimum calculation pressure: ' + parsed.pressure + ' bar'
                        : 'minimalne ciśnienie obliczeniowe: ' + parsed.pressure + ' bar')
            },
            openings: { value: parsed.openings, meaning: table3[parsed.openings] || null },
            safety: { value: parsed.safety, meaning: table4[parsed.safety] || null }
        }
    };
}

/**
 * isTankAllowedInstead(requiredCode, offeredCode, lang)
 * Reguła hierarchii 4.3.3: czy `offeredCode` może być użyty zamiast
 * wymaganego `requiredCode` (każda z 4 części na poziomie co najmniej
 * równoważnym). Nie uwzględnia przepisów szczególnych 4.3.5 ani pozycji
 * z obowiązkowym indywidualnym przypisaniem kodu ("(+)" w kolumnie 12).
 */
function isTankAllowedInstead(requiredCode, offeredCode, lang) {
    const resolvedLang = lang || getLang();
    const K = keysFor(resolvedLang);
    const required = splitTankCode(requiredCode);
    const offered = splitTankCode(offeredCode);

    if (!required || !offered) {
        const note = (resolvedLang === 'en')
            ? 'Could not split one of the codes into parts.'
            : 'Nie udało się rozłożyć jednego z kodów na części.';
        return { allowed: false, note: note };
    }

    function rank(list, value) {
        const idx = list.indexOf(value);
        return idx === -1 ? null : idx;
    }

    const lists = [HIERARCHY.part1, HIERARCHY.part2, HIERARCHY.part3, HIERARCHY.part4];
    const reqValues = [required.type, required.pressure, required.openings, required.safety];
    const offValues = [offered.type, offered.pressure, offered.openings, offered.safety];

    const details = K.partNames.map(function (name, i) {
        const reqRank = rank(lists[i], reqValues[i]);
        const offRank = rank(lists[i], offValues[i]);
        const ok = (reqRank !== null && offRank !== null && offRank >= reqRank);
        return { part: name, required: reqValues[i], offered: offValues[i], ok: ok };
    });

    const allowed = details.every(function (d) { return d.ok; });

    const note = (resolvedLang === 'en')
        ? (allowed
            ? 'All 4 parts of the code meet or exceed the required level.'
            : 'At least one part of the code is below the required level — see "details".')
        : (allowed
            ? 'Wszystkie 4 części kodu spełniają lub przewyższają wymagany poziom.'
            : 'Co najmniej jedna część kodu jest poniżej wymaganego poziomu — sprawdź "details".');

    const caveat = (resolvedLang === 'en')
        ? 'General hierarchy rule (4.3.3) — does not account for special provisions in 4.3.5 or entries with a mandatory individual tank code assignment ("(+)").'
        : 'Ogólna reguła hierarchii (4.3.3) — nie uwzględnia przepisów szczególnych 4.3.5 ani pozycji z obowiązkowym indywidualnym przypisaniem kodu ("(+)").';

    return { allowed: allowed, details: details, note: note, caveat: caveat };
}

module.exports = { decodeTankCode, isTankAllowedInstead, splitTankCode };

if (require.main === module) {
    console.log(decodeTankCode('L4BH'));
    console.log(isTankAllowedInstead('L4BN', 'L10CN'));
    console.log(isTankAllowedInstead('L4BN', 'SGAN'));
}
