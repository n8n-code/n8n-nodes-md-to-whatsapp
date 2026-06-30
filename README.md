# n8n-nodes-md-to-whatsapp

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![n8n Community Node](https://img.shields.io/badge/n8n-community%20node-purple.svg)

Convert Markdown text into WhatsApp-compatible formatting directly inside n8n workflows.

## What It Does

| Markdown Input           | WhatsApp Output            |
| ------------------------ | -------------------------- |
| `**bold**` / `__bold__`  | `*bold*`                   |
| `*italic*` / `_italic_`  | `_italic_`                 |
| `~~strike~~`             | `~strike~`                 |
| `` `inline code` ``      | `` `inline code` `` (kept) |
| ` ```fenced block``` `   | ` ```fenced block``` ` (kept) |
| `# Heading`              | `*Heading*`                |
| `[text](url)`            | `text (url)`               |
| `![alt](url)`            | `alt (url)`                |
| `- item` / `* item`      | `• item`                   |
| `1. item`                | `1. item` (kept)           |
| `> quote`                | `> quote` (kept)           |
| `---` / `***`            | (removed — WA has no HR)   |

## Install

```bash
npm install n8n-nodes-md-to-whatsapp
```

Or in n8n UI: **Settings → Community Nodes → Install → search `n8n-nodes-md-to-whatsapp`**

## Usage

### Mode 1: Text

Provide Markdown directly in the parameter panel. The node outputs a single
item with the converted WhatsApp text.

### Mode 2: JSON Field (Streaming)

Read Markdown from a field on each input item, write the converted WhatsApp
text to a new field. Preserves all other fields. Streams naturally — N input
items become N output items.

## Development

```bash
npm install
npm run build       # compile TypeScript
npm run lint        # eslint
npm run dev         # watch mode + n8n integration
```

## Learn How to Build Your Own n8n Node

This repository is also a **learning artifact**. See [`LEARNING.md`](./LEARNING.md)
for a comprehensive guide (in Indonesian) covering:

- Declarative vs Programmatic node patterns
- Project structure conventions
- Properties system, display options, routing
- Expressions & templating
- Build, test, publish workflow
- Common pitfalls (with fixes!)

The guide is based on the source of
[`scaffold-node.mjs`](https://raw.githubusercontent.com/kelvinzer0/n8n-openapi-node-ultimate/refs/heads/main/scripts/scaffold-node.mjs)
from `kelvinzer0/n8n-openapi-node-ultimate` and this actual implementation.

## License

MIT
