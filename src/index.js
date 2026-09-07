#!/usr/bin/env node
'use strict';

/**
 * src/index.js — serwer MCP "Asystent ADR przez MCP".
 *
 * Łączy dwa elementy:
 *  1) api.js — surowe zapytania do api.kocie.mba (numer UN, wyszukiwanie),
 *  2) rules/ — deterministyczne przeliczenia na podstawie zwróconych pól.
 *
 * Model AI wywołuje narzędzia poniżej; wynik każdego jest już gotową,
 * policzoną odpowiedzią (nie surowym tekstem przepisu do samodzielnej
 * interpretacji przez model).
 */

require('dotenv').config();

const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const api = require('./api');
const rules = require('./rules');

const server = new McpServer({
    name: 'adr-agreement-mcp-server',
    version: '0.1.0'
});

function textResult(payload) {
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(error) {
    const payload = {
        error: true,
        message: error.message,
        status: error.status || null,
        apiResponse: error.body || null
    };
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: true };
}

// ---------------------------------------------------------------------------
// lookup_un — surowy rekord Tabeli A dla numeru UN
// ---------------------------------------------------------------------------
server.registerTool(
    'lookup_un',
    {
        title: 'Wyszukaj numer UN',
        description: 'Zwraca surowy rekord Tabeli A Umowy ADR dla podanego numeru UN z api.kocie.mba. Jeden numer UN może zwrócić więcej niż jedną pozycję (np. różne grupy pakowania) — jeśli tak się stanie, doprecyzuj przez packingGroup.',
        inputSchema: {
            unNumber: z.string().describe('Numer UN, np. "1098"'),
            packingGroup: z.string().optional().describe('Opcjonalnie: grupa pakowania (I/II/III) do doprecyzowania wyniku, jeśli numer UN zwraca kilka pozycji')
        }
    },
    async function (args) {
        try {
            const records = await api.getByUnNumber(args.unNumber);
            const list = Array.isArray(records) ? records : [records];
            const filtered = args.packingGroup
                ? list.filter(function (r) { return r.packingGroup === args.packingGroup; })
                : list;
            return textResult(filtered.length ? filtered : list);
        } catch (err) {
            return errorResult(err);
        }
    }
);

// ---------------------------------------------------------------------------
// search_adr — wyszukiwanie po nazwie/fragmencie numeru UN
// ---------------------------------------------------------------------------
server.registerTool(
    'search_adr',
    {
        title: 'Szukaj towaru po nazwie',
        description: 'Wyszukuje towary niebezpieczne po nazwie (PL/EN) lub fragmencie numeru UN w api.kocie.mba. Zwraca skróconą listę dopasowań (numer UN, nazwa, klasa) — po znalezieniu właściwej pozycji użyj lookup_un po pełne dane.',
        inputSchema: {
            query: z.string().describe('Fragment nazwy lub numeru UN')
        }
    },
    async function (args) {
        try {
            const results = await api.search(args.query);
            return textResult(results);
        } catch (err) {
            return errorResult(err);
        }
    }
);

// ---------------------------------------------------------------------------
// build_proper_shipping_name — PSN
// ---------------------------------------------------------------------------
server.registerTool(
    'build_proper_shipping_name',
    {
        title: 'Zbuduj prawidłową nazwę przewozową (PSN)',
        description: 'Buduje bazową prawidłową nazwę przewozową dla numeru UN z api.kocie.mba i zwraca listę modyfikatorów (ODPAD, GORĄCY, STABILIZOWANY itd.) z warunkiem zastosowania każdego — o tym, czy dany modyfikator pasuje, decyduje kontekst przewozu podany przez użytkownika, nie to narzędzie.',
        inputSchema: {
            unNumber: z.string().describe('Numer UN, np. "1098"'),
            packingGroup: z.string().optional().describe('Opcjonalnie: grupa pakowania do doprecyzowania, jeśli numer UN zwraca kilka pozycji')
        }
    },
    async function (args) {
        try {
            const records = await api.getByUnNumber(args.unNumber);
            const list = Array.isArray(records) ? records : [records];
            const filtered = args.packingGroup
                ? list.filter(function (r) { return r.packingGroup === args.packingGroup; })
                : list;

            if (filtered.length > 1) {
                return textResult({
                    ambiguous: true,
                    message: 'Numer UN zwraca więcej niż jedną pozycję — doprecyzuj przez packingGroup.',
                    candidates: filtered.map(function (r) { return { packingGroup: r.packingGroup, hazardClass: r.hazardClass }; })
                });
            }

            const record = filtered[0] || list[0];
            return textResult(rules.buildProperShippingName(record));
        } catch (err) {
            return errorResult(err);
        }
    }
);

// ---------------------------------------------------------------------------
// resolve_lq_eq — ilości ograniczone i wyłączone
// ---------------------------------------------------------------------------
server.registerTool(
    'resolve_lq_eq',
    {
        title: 'Sprawdź LQ/EQ dla numeru UN',
        description: 'Zwraca limity ilości ograniczonych (LQ) i wyłączonych (EQ) dla numeru UN, na podstawie pól limitedQuantity/exceptedQuantity z api.kocie.mba.',
        inputSchema: {
            unNumber: z.string().describe('Numer UN, np. "1098"'),
            packingGroup: z.string().optional()
        }
    },
    async function (args) {
        try {
            const records = await api.getByUnNumber(args.unNumber);
            const list = Array.isArray(records) ? records : [records];
            const filtered = args.packingGroup
                ? list.filter(function (r) { return r.packingGroup === args.packingGroup; })
                : list;
            const record = filtered[0] || list[0];
            return textResult(rules.resolveLQEQ(record));
        } catch (err) {
            return errorResult(err);
        }
    }
);

// ---------------------------------------------------------------------------
// calculate_1136 — wyłączenie 1.1.3.6
// ---------------------------------------------------------------------------
server.registerTool(
    'calculate_1136',
    {
        title: 'Oblicz wyłączenie 1.1.3.6',
        description: 'Liczy, czy zestaw towarów na jednej jednostce transportowej mieści się w wyłączeniu 1.1.3.6 (drobne ilości). Każda pozycja wymaga transportCategory (pobranej wcześniej np. przez lookup_un) i ilości (kg lub litry, zgodnie z regułami 1.1.3.6.3).',
        inputSchema: {
            items: z.array(z.object({
                unNumber: z.string().optional(),
                transportCategory: z.union([z.string(), z.number()]).describe('Kategoria transportowa 0-4'),
                quantity: z.number().describe('Ilość w kg lub litrach, zgodnie z regułami 1.1.3.6.3'),
                footnoteA: z.boolean().optional().describe('true tylko dla UN-ów z przypisem "a" w kategorii 1 (limit 50 kg zamiast 20)')
            })).describe('Lista towarów na jednostce transportowej')
        }
    },
    async function (args) {
        try {
            return textResult(rules.calculate1136(args.items));
        } catch (err) {
            return errorResult(err);
        }
    }
);

// ---------------------------------------------------------------------------
// check_mixed_packing — pakowanie razem
// ---------------------------------------------------------------------------
server.registerTool(
    'check_mixed_packing',
    {
        title: 'Sprawdź pakowanie razem dwóch towarów',
        description: 'Sprawdza, czy dwa towary (po kodach mixedPacking, np. "MP15") mogą być pakowane razem w jednej sztuce przesyłki. Dla jednoznacznych kodów zwraca twardy werdykt, dla pozostałych oba opisy do interpretacji.',
        inputSchema: {
            codeA: z.string().describe('Kod mixedPacking pierwszego towaru, np. "MP15"'),
            codeB: z.string().describe('Kod mixedPacking drugiego towaru'),
            sameUnNumber: z.boolean().optional().describe('Czy oba towary mają ten sam numer UN (istotne dla kodów MP20-24, klasa 1)')
        }
    },
    async function (args) {
        try {
            return textResult(rules.checkMixedPacking(args.codeA, args.codeB, args.sameUnNumber === true));
        } catch (err) {
            return errorResult(err);
        }
    }
);

// ---------------------------------------------------------------------------
// decode_tank_code / compare_tank_codes
// ---------------------------------------------------------------------------
server.registerTool(
    'decode_tank_code',
    {
        title: 'Zdekoduj kod cysterny ADR',
        description: 'Rozkłada kod cysterny (np. "L4BH") na 4 znaczące części: typ, ciśnienie obliczeniowe, otwory, zawory/urządzenia bezpieczeństwa.',
        inputSchema: {
            code: z.string().describe('Kod cysterny, np. "L4BH"')
        }
    },
    async function (args) {
        try {
            return textResult(rules.decodeTankCode(args.code));
        } catch (err) {
            return errorResult(err);
        }
    }
);

server.registerTool(
    'compare_tank_codes',
    {
        title: 'Porównaj kody cystern wg reguły hierarchii',
        description: 'Sprawdza regułę hierarchii ADR 4.3.3: czy cysterna offeredCode może być użyta zamiast wymaganej requiredCode. Nie uwzględnia przepisów szczególnych 4.3.5 ani pozycji z obowiązkowym indywidualnym przypisaniem kodu.',
        inputSchema: {
            requiredCode: z.string().describe('Wymagany kod cysterny dla danego towaru'),
            offeredCode: z.string().describe('Kod cysterny, który chcesz sprawdzić jako alternatywę')
        }
    },
    async function (args) {
        try {
            return textResult(rules.isTankAllowedInstead(args.requiredCode, args.offeredCode));
        } catch (err) {
            return errorResult(err);
        }
    }
);

// ---------------------------------------------------------------------------
// decode_hazard_id / decode_classification_code
// ---------------------------------------------------------------------------
server.registerTool(
    'decode_hazard_id',
    {
        title: 'Zdekoduj numer Kemlera',
        description: 'Wyjaśnia numer rozpoznawczy zagrożenia (numer Kemlera, np. "336" albo "X462") — znaczenie cyfr i prefiksu "X" (reakcja z wodą).',
        inputSchema: {
            code: z.string().describe('Numer Kemlera, np. "336" albo "X462"')
        }
    },
    async function (args) {
        try {
            return textResult(rules.decodeHazardId(args.code));
        } catch (err) {
            return errorResult(err);
        }
    }
);

server.registerTool(
    'decode_classification_code',
    {
        title: 'Zdekoduj kod klasyfikacyjny',
        description: 'Wyjaśnia kod klasyfikacyjny towaru (pole classificationCode, np. "FT1" albo dla klasy 1: "1.1D") w kontekście jego klasy zagrożenia.',
        inputSchema: {
            hazardClass: z.string().describe('Klasa zagrożenia, np. "3", "6.1", "1"'),
            code: z.string().describe('Kod klasyfikacyjny, np. "FT1" albo "1.1D"')
        }
    },
    async function (args) {
        try {
            return textResult(rules.decodeClassificationCode(args.hazardClass, args.code));
        } catch (err) {
            return errorResult(err);
        }
    }
);

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('adr-agreement-mcp-server: połączono (stdio), język danych: ' + rules.getLang());
}

main().catch(function (err) {
    console.error('adr-agreement-mcp-server: błąd startu:', err);
    process.exit(1);
});
