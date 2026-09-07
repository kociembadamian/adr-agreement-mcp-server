# ADR Assistant via MCP

An [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that connects AI assistants (Claude, ChatGPT, and other MCP-compatible clients) to a database of ADR dangerous goods and to a deterministic calculation engine that interprets the ADR Agreement's provisions itself — without the language model guessing.

Open source project, licensed under AGPL-3.0.

## How it works

1. **Data** — the tools fetch current data from [api.kocie.mba](https://api.kocie.mba) (Table A of the ADR Agreement and all related information: LQ/EQ, tank codes, special provisions, Kemler numbers, etc.).
2. **Calculations** — the result is not handed to the model as raw text to interpret. The rules engine (`src/rules/`) computes the answer itself (e.g. whether a consignment falls under the 1.1.3.6 exemption, whether two goods can be packed together, how to break down a tank code) and returns a ready-made result. The AI model only relays the question and phrases the answer in natural language — it does not interpret the regulation itself.

## Tools (MCP tools)

| Tool | What it does |
|---|---|
| `lookup_un` | Returns the full Table A record for a UN number |
| `search_adr` | Searches for goods by name (PL/EN) or by a UN number fragment |
| `build_proper_shipping_name` | Builds the proper shipping name (PSN), along with a list of available modifiers |
| `resolve_lq_eq` | Returns the limited quantity (LQ) and excepted quantity (EQ) limits |
| `calculate_1136` | Calculates whether a set of goods falls under the 1.1.3.6 exemption |
| `check_mixed_packing` | Checks whether two goods can be packed together in a single package |
| `decode_tank_code` | Breaks down a tank code (e.g. `L4BH`) and explains each part |
| `compare_tank_codes` | Checks whether one tank can replace another under the hierarchy rule (4.3.3) |
| `decode_hazard_id` | Explains the hazard identification number (Kemler number) |
| `decode_classification_code` | Explains a goods' classification code in the context of its class |

All tools work with two data languages (PL/EN) — see configuration below.

## Requirements

- [Node.js](https://nodejs.org) version 18 or newer
- Claude Desktop, ChatGPT (Developer mode / Connectors), or any other MCP-compatible client

## Installation

```bash
git clone https://github.com/kociembadamian/adr-agreement-mcp-server.git
cd adr-agreement-mcp-server
npm install
```

Copy the configuration file:

```bash
cp .env.example .env
```

The default `.env` is ready to use right away (plug and play) — it uses a shared demo token. If you need a higher request limit, get in touch at [damian@kocie.mba](mailto:damian@kocie.mba) and paste your own token into `ADR_API_TOKEN` (see *Rate limits* below).

## Connecting in Claude Desktop

1. Open the Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add an entry (replace the path with the full, absolute path to the repo on your machine):

```json
{
  "mcpServers": {
    "adr-agreement-mcp-server": {
      "command": "node",
      "args": ["/full/path/to/adr-agreement-mcp-server/src/index.js"],
      "env": {
        "ADR_API_URL": "https://api.kocie.mba",
        "ADR_API_TOKEN": "DEMO-ADR-2026-PUBLIC",
        "ADR_DATA_LANG": "en"
      }
    }
  }
}
```

3. Save the file and restart Claude Desktop.
4. In a new conversation, check the tools icon (hammer) — you should see 10 ADR tools listed.

## Connecting in ChatGPT

Support for local MCP servers in ChatGPT (Developer mode / Connectors) is evolving quickly on OpenAI's side, so it's worth checking the current documentation before configuring: [platform.openai.com — Model Context Protocol](https://platform.openai.com/docs/mcp). The setup principle is the same as in Claude Desktop: point it to the command that starts the server (`node src/index.js`) along with the environment variables from the `.env` section above.

## Example queries

Once connected, you can ask the assistant directly, e.g.:

- "Look up UN 1098 and give me the proper shipping name"
- "Do 15 kg of UN 1098 and 3 kg of another transport category 2 good fall under the 1.1.3.6 exemption?"
- "Can a good with tank code L4BH and a good with tank code L10CN be carried in the same tank?"
- "What does Kemler number 336 mean?"

The assistant will pick the right tool on its own and return an already-computed answer.

## Rate limits

The default token in `.env.example` (`DEMO-ADR-2026-PUBLIC`) is shared by all plug-and-play users: **35 requests/day and 15 requests/hour per IP address**. That's enough for testing and everyday individual use, but for team use or more frequent requests it's worth getting your own token — write to [damian@kocie.mba](mailto:damian@kocie.mba).

## Architecture

```
AI model (Claude / ChatGPT)
        │  MCP (stdio)
        ▼
adr-agreement-mcp-server  (this project)
   ├── src/index.js        ← registers the MCP tools
   ├── src/api.js           ← client for api.kocie.mba
   └── src/rules/            ← deterministic calculation engine
        │  HTTPS
        ▼
api.kocie.mba  (Table A of the ADR Agreement and related tables)
```

Reference data (`data/pl/`, `data/en/`) ships with the repo and is used locally by the rules engine — requests to `api.kocie.mba` only cover the records for specific UN numbers.

## ADR, NIS2, and our decision to go open source

Companies in the dangerous goods transport sector are increasingly also subject to the [NIS2](https://digital-strategy.ec.europa.eu/en/policies/nis2-directive) directive on cybersecurity and supply-chain risk management — including risk related to using AI systems in processes that affect safety. This project is deliberately fully open and auditable: the code, reference data, and calculation logic are all publicly available, and answers about ADR provisions are not produced by the model "guessing" — they come from deterministic, traceable calculations. This doesn't remove the need for your own risk and compliance assessment within your organization — but it does make it easier to audit where a given answer comes from.

## License

[AGPL-3.0](LICENSE). If you modify or extend this project — including as a hosted network service — you are required to publish your changes under the same license.

## Contact

Damian Kociemba — [damian@kocie.mba](mailto:damian@kocie.mba)
