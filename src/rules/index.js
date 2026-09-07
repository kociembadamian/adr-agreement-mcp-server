'use strict';

/**
 * rules/index.js — punkt wejścia do silnika deterministycznego.
 * Użycie: const rules = require('./rules'); rules.decodeHazardId('336'); itd.
 * Język danych: zmienna środowiskowa ADR_DATA_LANG (patrz .env.example).
 */

const { decodeHazardId } = require('./hazardId');
const { decodeClassificationCode } = require('./classificationCode');
const { decodeTankCode, isTankAllowedInstead, splitTankCode } = require('./tankCode');
const { calculate1136 } = require('./transportCategory');
const { describeMixedPackingCode, checkMixedPacking } = require('./mixedPacking');
const { buildProperShippingName } = require('./properShippingName');
const { resolveLimitedQuantity, resolveExceptedQuantity, resolveLQEQ } = require('./limitedExceptedQuantity');
const { getLang } = require('./dataLoader');

module.exports = {
    // hazardId.js
    decodeHazardId,
    // classificationCode.js
    decodeClassificationCode,
    // tankCode.js
    decodeTankCode,
    isTankAllowedInstead,
    splitTankCode,
    // transportCategory.js
    calculate1136,
    // mixedPacking.js
    describeMixedPackingCode,
    checkMixedPacking,
    // properShippingName.js
    buildProperShippingName,
    // limitedExceptedQuantity.js
    resolveLimitedQuantity,
    resolveExceptedQuantity,
    resolveLQEQ,
    // dataLoader.js
    getLang
};
