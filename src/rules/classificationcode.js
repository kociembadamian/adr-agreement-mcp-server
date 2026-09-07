'use strict';

/**
 * classificationCode.js — kod klasyfikacyjny towaru.
 * Źródło: ADR dział 2.2, pole API: classificationCode.
 * Znaczenie zależy od klasy zagrożenia (hazardClass). Klasa 1: kod =
 * podklasa (1.1–1.6) + litera grupy zgodności (A–S), np. "1.1D" — rozdzielane
 * i dekodowane osobno.
 */

const { loadData, getLang } = require('./dataLoader');

function classKeyFromHazardClass(hazardClass) {
    return 'class_' + String(hazardClass || '').trim().replace('.', '_');
}

/**
 * decodeClassificationCode(hazardClass, code, lang)
 * Zwraca: { hazardClass, code, found, meaning, class1?: { division, group, divisionMeaning, groupMeaning } }
 */
function decodeClassificationCode(hazardClass, code, lang) {
    const data = loadData('classificationCode');
    const resolvedLang = lang || getLang();
    const cleanClass = String(hazardClass || '').trim();
    const cleanCode = String(code || '').trim();
    const classKey = classKeyFromHazardClass(cleanClass);
    const classTable = data[classKey];

    if (!classTable) {
        const note = (resolvedLang === 'en')
            ? 'No data for class "' + cleanClass + '" in classificationCode.json.'
            : 'Brak danych dla klasy "' + cleanClass + '" w classificationCode.json.';
        return { hazardClass: cleanClass, code: cleanCode, found: false, meaning: null, note: note };
    }

    if (classKey === 'class_1') {
        const match = cleanCode.match(/^(\d\.\d)([A-Za-z])$/);
        if (!match) {
            const note = (resolvedLang === 'en')
                ? 'Class 1 code does not match the "<division><group>" pattern, e.g. "1.1D".'
                : 'Kod klasy 1 nie pasuje do wzorca "<podklasa><grupa>", np. "1.1D".';
            return { hazardClass: cleanClass, code: cleanCode, found: false, meaning: null, note: note };
        }
        const division = match[1];
        const group = match[2].toUpperCase();
        const divisionMeaning = (classTable.podklasy || classTable.divisions || {})[division] || null;
        const groupMeaning = (classTable.grupy_zgodnosci || classTable.compatibility_groups || {})[group] || null;

        return {
            hazardClass: cleanClass,
            code: cleanCode,
            found: Boolean(divisionMeaning && groupMeaning),
            meaning: [divisionMeaning, groupMeaning].filter(Boolean).join(' + '),
            class1: {
                division: division,
                group: group,
                divisionMeaning: divisionMeaning,
                groupMeaning: groupMeaning
            }
        };
    }

    const meaning = classTable[cleanCode];
    return {
        hazardClass: cleanClass,
        code: cleanCode,
        found: Boolean(meaning),
        meaning: meaning || null
    };
}

module.exports = { decodeClassificationCode };

if (require.main === module) {
    console.log(decodeClassificationCode('3', 'FT1'));
    console.log(decodeClassificationCode('1', '1.1D'));
    console.log(decodeClassificationCode('6.1', 'T1'));
}
