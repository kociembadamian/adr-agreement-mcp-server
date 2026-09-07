# adr-agreement-mcp-server
MCP server for handling ADR Agreement provisions for AI models / Serwer MCP do obsługi przepisów Umowy ADR dla modeli AI

FOR ENGLISH - [GO HERE](README_en.md)

# Asystent ADR przez MCP

Serwer [MCP](https://modelcontextprotocol.io) (Model Context Protocol), który podłącza asystentów AI (Claude, ChatGPT i inne wspierające MCP) do bazy danych towarów niebezpiecznych ADR i do deterministycznego silnika obliczeniowego, który sam interpretuje przepisy Umowy ADR — bez zgadywania przez model językowy.

Projekt open source, licencja AGPL-3.0.

## Zasada działania

1. **Dane** — narzędzia pobierają aktualne dane z [api.kocie.mba](https://api.kocie.mba) (Tabela A Umowy ADR i wszystkie powiązane informacje: LQ/EQ, kody cystern, przepisy szczególne, numery Kemlera, itd.).
2. **Obliczenia** — wynik nie trafia do modelu jako surowy tekst do zinterpretowania. Silnik reguł (`src/rules/`) sam liczy odpowiedź (np. czy przesyłka mieści się w wyłączeniu 1.1.3.6, czy dwa towary można pakować razem, jak rozłożyć kod cysterny) i zwraca gotowy wynik. Model AI jedynie przekazuje pytanie i formułuje odpowiedź w naturalnym języku — nie interpretuje przepisu samodzielnie.

## Narzędzia (MCP tools)

| Narzędzie | Co robi |
|---|---|
| `lookup_un` | Zwraca pełny rekord Tabeli A dla numeru UN |
| `search_adr` | Wyszukuje towar po nazwie (PL/EN) lub fragmencie numeru UN |
| `build_proper_shipping_name` | Buduje prawidłową nazwę przewozową (PSN) wraz z listą dostępnych modyfikatorów |
| `resolve_lq_eq` | Zwraca limity ilości ograniczonych (LQ) i wyłączonych (EQ) |
| `calculate_1136` | Liczy, czy zestaw towarów mieści się w wyłączeniu 1.1.3.6 |
| `check_mixed_packing` | Sprawdza, czy dwa towary można pakować razem w jednej sztuce przesyłki |
| `decode_tank_code` | Rozkłada kod cysterny (np. `L4BH`) na znaczenie poszczególnych części |
| `compare_tank_codes` | Sprawdza, czy jedna cysterna może zastąpić drugą wg reguły hierarchii (4.3.3) |
| `decode_hazard_id` | Wyjaśnia numer rozpoznawczy zagrożenia (numer Kemlera) |
| `decode_classification_code` | Wyjaśnia kod klasyfikacyjny towaru w kontekście jego klasy |

Wszystkie narzędzia działają w dwóch wersjach językowych danych (PL/EN) — patrz konfiguracja niżej.

## Wymagania

- [Node.js](https://nodejs.org) w wersji 18 lub nowszej
- Claude Desktop, ChatGPT (Developer mode / Connectors) lub inny klient obsługujący MCP

## Instalacja

```bash
git clone https://github.com/kociembadamian/adr-agreement-mcp-server.git
cd adr-agreement-mcp-server
npm install
```

Skopiuj plik konfiguracyjny:

```bash
cp .env.example .env
```

Domyślny `.env` jest gotowy do użycia od razu (plug and play) — korzysta ze wspólnego tokena demo. Jeśli chcesz wyższy limit zapytań, skontaktuj się z nami pisząc na [damian@kocie.mba](mailto:damian@kocie.mba) i wklej go do `ADR_API_TOKEN` (patrz sekcja *Limity* niżej).

## Podłączenie w Claude Desktop

1. Otwórz plik konfiguracyjny Claude Desktop:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Dodaj wpis (podmień ścieżkę na pełną, absolutną ścieżkę do repo na Twoim dysku):

```json
{
  "mcpServers": {
    "adr-agreement-mcp-server": {
      "command": "node",
      "args": ["/pelna/sciezka/do/adr-agreement-mcp-server/src/index.js"],
      "env": {
        "ADR_API_URL": "https://api.kocie.mba",
        "ADR_API_TOKEN": "DEMO-ADR-2026-PUBLIC",
        "ADR_DATA_LANG": "pl"
      }
    }
  }
}
```

3. Zapisz plik i uruchom ponownie Claude Desktop.
4. W nowej rozmowie sprawdź ikonę narzędzi (młotek) — powinieneś zobaczyć 10 narzędzi ADR.

## Podłączenie w ChatGPT

Obsługa lokalnych serwerów MCP w ChatGPT (tryb deweloperski / Connectors) zmienia się dość szybko po stronie OpenAI, więc przed konfiguracją warto sprawdzić aktualną dokumentację: [platform.openai.com — Model Context Protocol](https://platform.openai.com/docs/mcp). Zasada konfiguracji jest analogiczna jak w Claude Desktop: wskazujesz komendę uruchamiającą serwer (`node src/index.js`) oraz zmienne środowiskowe z sekcji `.env` powyżej.

## Przykładowe zapytania

Po podłączeniu możesz zapytać asystenta wprost, np.:

- „Sprawdź numer UN 1098 i podaj prawidłową nazwę przewozową"
- „Czy 15 kg UN 1098 i 3 kg innego towaru kategorii transportowej 2 mieszczą się w wyłączeniu 1.1.3.6?"
- „Czy towar z kodem cysterny L4BH i towar z kodem L10CN mogą być przewożone tą samą cysterną?"
- „Co oznacza numer Kemlera 336?"

Asystent sam dobierze odpowiednie narzędzie i zwróci już policzoną odpowiedź.

## Limity zapytań

Domyślny token w `.env.example` (`DEMO-ADR-2026-PUBLIC`) jest współdzielony przez wszystkich użytkowników plug-and-play: **35 zapytań/dobę oraz 15 zapytań/godzinę na adres IP**. To wystarcza do testów i codziennego użytku pojedynczej osoby, ale przy pracy zespołowej lub częstszym użyciu warto wygenerować własny token — napisz na [damian@kocie.mba](mailto:damian@kocie.mba).

## Architektura

```
Model AI (Claude / ChatGPT)
        │  MCP (stdio)
        ▼
adr-agreement-mcp-server  (ten projekt)
   ├── src/index.js        ← rejestracja narzędzi MCP
   ├── src/api.js           ← klient api.kocie.mba
   └── src/rules/            ← deterministyczny silnik obliczeniowy
        │  HTTPS
        ▼
api.kocie.mba  (Tabela A Umowy ADR i tabele powiązane)
```

Dane referencyjne (`data/pl/`, `data/en/`) są dołączone do repo i wykorzystywane lokalnie przez silnik reguł — zapytania do `api.kocie.mba` dotyczą tylko rekordów konkretnych numerów UN.

## ADR, NIS2 i nasza decyzja o otwartoźródłowości (open source)

Firmy z sektora transportu towarów niebezpiecznych coraz częściej podlegają też wymogom dyrektywy [NIS2](https://digital-strategy.ec.europa.eu/en/policies/nis2-directive) dotyczącej cyberbezpieczeństwa i zarządzania ryzykiem w łańcuchu dostaw — w tym ryzykiem związanym z wykorzystaniem systemów AI w procesach mających wpływ na bezpieczeństwo. Ten projekt jest zamierzenie w pełni jawny i sprawdzalny: kod, dane referencyjne i logika obliczeniowa są publicznie dostępne, a odpowiedzi dotyczące przepisów ADR nie powstają w wyniku "zgadywania" przez model, tylko w wyniku deterministycznych, możliwych do prześledzenia obliczeń. Nie zwalnia to z własnej oceny ryzyka i zgodności w Twojej organizacji — ale ułatwia audyt tego, skąd bierze się dana odpowiedź.

## Licencja

[AGPL-3.0](LICENSE). Jeśli zmodyfikujesz lub rozwiniesz ten projekt — również w wersji hostowanej jako usługa sieciowa — masz obowiązek opublikować swoje zmiany na tej samej licencji.

## Kontakt

Damian Kociemba — [damian@kocie.mba](mailto:damian@kocie.mba)
