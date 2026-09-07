'use strict';

/**
 * api.js — klient do api.kocie.mba.
 * Adres i token czytane z ADR_API_URL / ADR_API_TOKEN (patrz .env.example).
 * Serwer MCP jest zwykłym klientem HTTP tego API — nagłówek X-API-Key,
 * bez żadnej specjalnej logiki po stronie API dla "klientów AI".
 */

const DEFAULT_URL = 'https://api.kocie.mba';
const USER_AGENT = 'adr-agreement-mcp-server (+https://github.com/kociembadamian/adr-agreement-mcp-server)';

function getConfig() {
    const baseUrl = (process.env.ADR_API_URL || DEFAULT_URL).replace(/\/+$/, '');
    const token = process.env.ADR_API_TOKEN || '';
    return { baseUrl, token };
}

/**
 * request(params) -> sparsowana odpowiedź JSON.
 * Rzuca Error z polami .status (kod HTTP) i .body (sparsowana odpowiedź,
 * jeśli API zwróciło JSON z błędem) przy odpowiedzi innej niż 2xx.
 */
async function request(params) {
    const { baseUrl, token } = getConfig();
    const url = new URL(baseUrl + '/');

    Object.keys(params || {}).forEach(function (key) {
        const value = params[key];
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });

    let response;
    try {
        response = await fetch(url.toString(), {
            headers: {
                'X-API-Key': token,
                'User-Agent': USER_AGENT,
                'Accept': 'application/json'
            }
        });
    } catch (networkError) {
        const error = new Error('Nie udało się połączyć z api.kocie.mba: ' + networkError.message);
        error.cause = networkError;
        throw error;
    }

    let body = null;
    try {
        body = await response.json();
    } catch (parseError) {
        body = null;
    }

    if (!response.ok) {
        const message = (body && body.message)
            ? body.message
            : ('api.kocie.mba odpowiedziało błędem HTTP ' + response.status);
        const error = new Error(message);
        error.status = response.status;
        error.body = body;
        throw error;
    }

    return body;
}

/**
 * getByUnNumber(unNumber) -> tablica rekordów Tabeli A dla numeru UN.
 * Jeden numer UN może zwrócić kilka pozycji (np. różne grupy pakowania) —
 * ta funkcja NIE dokonuje disambiguacji, zwraca to, co zwróci API.
 */
async function getByUnNumber(unNumber) {
    return request({ un: unNumber });
}

/**
 * search(query) -> lista pasujących pozycji (numer UN, nazwa PL/EN, klasa),
 * dopasowanie po numerze UN lub fragmencie nazwy.
 */
async function search(query) {
    return request({ q: query });
}

module.exports = { getByUnNumber, search, getConfig };
