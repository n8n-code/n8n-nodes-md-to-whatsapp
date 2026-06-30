# Belajar Membangun n8n Community Nodes — Panduan Lengkap

> Panduan belajar berdasarkan repo `n8n-nodes-md-to-whatsapp` (node contoh yang
> sudah di-build di repo ini) dan scaffold script
> [`scaffold-node.mjs`](https://raw.githubusercontent.com/kelvinzer0/n8n-openapi-node-ultimate/refs/heads/main/scripts/scaffold-node.mjs)
> dari `kelvinzer0/n8n-openapi-node-ultimate`.

---

## Daftar Isi

1. [Apa itu n8n Node?](#1-apa-itu-n8n-node)
2. [Dua Pola Besar: Declarative vs Programmatic](#2-dua-pola-besar-declarative-vs-programmatic)
3. [Struktur Direktori Standar](#3-struktur-direktori-standar)
4. [Anatomy of `package.json`](#4-anatomy-of-packagejson)
5. [Anatomy of a Node File](#5-anatomy-of-a-node-file)
6. [Anatomy of a Credential File](#6-anatomy-of-a-credential-file)
7. [Pola A: Membangun Node Declarative (API)](#7-pola-a-membangun-node-declarative-api)
8. [Pola B: Membangun Node Programmatic (Transform)](#8-pola-b-membangun-node-programmatic-transform)
9. [Properties System — Schema Parameter UI](#9-properties-system--schema-parameter-ui)
10. [Display Options — Conditional UI](#10-display-options--conditional-ui)
11. [Routing & Request Metadata (Declarative)](#11-routing--request-metadata-declarative)
12. [Expressions & Templating](#12-expressions--templating)
13. [Icons](#13-icons)
14. [Codex Metadata (`*.node.json`)](#14-codex-metadata-nodejson)
15. [Build, Test, Publish](#15-build-test-publish)
16. [Common Pitfalls](#16-common-pitfalls)
17. [Sumber Belajar Lanjutan](#17-sumber-belajar-lanjutan)

---

## 1. Apa itu n8n Node?

**n8n node** adalah modul TypeScript/JavaScript yang bisa di-*install* ke dalam
n8n untuk menambahkan integrasi atau operasi baru. Ada dua jenis:

- **Built-in nodes** — dikembangkan oleh tim n8n, distribusi via `n8n-nodes-base`
- **Community nodes** — dikembangkan siapa saja, distribusi via npm dengan
  keyword `n8n-community-node-package`

Community node adalah cara n8n ekosistem tumbuh tanpa harus menunggu tim n8n
meng-merge PR. Setiap orang bisa publish node untuk API atau transformasi
favoritnya, dan user lain tinggal install via UI n8n: **Settings → Community
Nodes → Install**.

Setiap community node pada dasarnya adalah **npm package** dengan struktur
khusus dan field `n8n` di `package.json` yang memberitahu n8n di mana menemukan
file node dan credential yang sudah di-compile.

---

## 2. Dua Pola Besar: Declarative vs Programmatic

Ini adalah konsep paling penting untuk dipahami. **Pilihan pola menentukan
seluruh struktur kode kamu.**

### 2a. Declarative Node (untuk API calls)

- **Tidak ada method `execute()`** — n8n yang mengeksekusi request berdasarkan
  metadata `routing` di properties
- Cocok untuk: REST/GraphQL API yang punya OpenAPI spec
- Lebih sedikit boilerplate, lebih konsisten UX
- Inilah pola yang dihasilkan oleh `scaffold-node.mjs`

```typescript
export class MyApi implements INodeType {
  description: INodeTypeDescription = {
    // ... metadata, properties, requestDefaults
    // TIDAK ada method execute()
  };
}
```

### 2b. Programmatic Node (untuk transformasi / non-HTTP)

- **Wajib implement `execute()`** — kamu yang menulis logic-nya
- Cocok untuk: data transformation, file parsing, local computation,
  protocol non-HTTP (gRPC, WebSocket, MQTT)
- Inilah pola yang dipakai node `MdToWhatsapp` di repo ini

```typescript
export class MyTransform implements INodeType {
  description: INodeTypeDescription = { /* metadata + properties */ };

  async execute(this: IExecuteFunctions): Promise<NodeExecutionWithMetadata[][]> {
    // Baca parameter, proses, return items
  }
}
```

### Tabel Perbandingan

| Aspek              | Declarative                     | Programmatic                         |
| ------------------ | ------------------------------- | ------------------------------------ |
| `execute()` method | ❌ Tidak ada                    | ✅ Wajib                             |
| HTTP request       | n8n handle otomatis via routing | Kamu handle manual                   |
| `requestDefaults`  | ✅ Biasanya ada (baseURL, headers) | ❌ Tidak relevan                  |
| `credentials`      | ✅ Biasanya ada (API key, OAuth) | ❌ Biasanya tidak (no API)          |
| Cocok untuk        | REST/GraphQL API                | Transform, parser, local computation |
| Boilerplate        | Lebih sedikit                   | Lebih banyak                         |
| Fleksibilitas      | Terbatas schema n8n             | Tanpa batas                          |

---

## 3. Struktur Direktori Standar

Pola ini mengikuti `n8n-nodes-starter` (referensi resmi n8n):

```
n8n-nodes-md-to-whatsapp/                  ← root project (npm package)
├── package.json                           ← manifest + n8n field
├── tsconfig.json                          ← TypeScript config
├── .prettierrc.js                         ← code style
├── eslint.config.mjs                      ← linter
├── .gitignore
├── .npmignore                             ← exclude source dari npm publish
├── .vscode/
│   ├── extensions.json                    ← rekomendasi extension VSCode
│   └── launch.json                        ← debug config (attach ke n8n)
├── README.md
├── credentials/                           ← kosong di repo ini (no API)
│   └── XxxApi.credentials.ts              ← (untuk node API)
├── icons/                                 ← global icon fallback
│   ├── md-to-whatsapp.svg
│   └── md-to-whatsapp.dark.svg
└── nodes/
    └── MdToWhatsapp/                      ← 1 folder per node class
        ├── MdToWhatsapp.node.ts           ← main node file
        ├── MdToWhatsapp.node.json         ← codex metadata
        ├── md-to-whatsapp.svg             ← icon (light)
        ├── md-to-whatsapp.dark.svg        ← icon (dark)
        ├── GenericFunctions.ts            ← helper functions (opsional)
        └── resources/                     ← (declarative pola) sub-folder per resource
            ├── index.ts                   ← re-export semua resource
            └── message/
                └── index.ts               ← operation + field descriptions
```

### Aturan Penting

1. **Satu folder per node class** di `nodes/<ClassName>/`. Nama folder = nama
   class tanpa suffix "Node".
2. **Icon file selalu berpasangan**: `xxx.svg` (light) + `xxx.dark.svg` (dark).
   Bisa juga `.png` / `.jpg` tapi SVG lebih disarankan.
3. **Compile output harus `dist/`** — field `n8n.nodes` di `package.json`
   menunjuk ke `dist/nodes/.../*.node.js` (file JavaScript hasil compile,
   BUKAN TypeScript source).
4. **Folder `resources/`** hanya untuk pola declarative API node dengan banyak
   resource. Untuk node transform sederhana seperti `MdToWhatsapp`, tidak perlu.

---

## 4. Anatomy of `package.json`

Bagian n8n-specific ada di field `n8n`:

```json
{
  "name": "n8n-nodes-md-to-whatsapp",
  "version": "1.0.0",
  "description": "...",
  "license": "MIT",
  "keywords": [
    "n8n",
    "n8n-community-node",
    "n8n-node",
    "n8n-community-node-package",  ← WAJIB keyword ini supaya muncul di search n8n
    "whatsapp",
    "markdown"
  ],
  "scripts": {
    "build": "n8n-node build",
    "dev": "n8n-node dev",
    "lint": "n8n-node lint",
    "release": "n8n-node release"
  },
  "files": ["dist"],               ← hanya publish folder dist ke npm
  "n8n": {                          ← INI FIELD KUNCInya
    "n8nNodesApiVersion": 1,
    "strict": true,
    "nodes": [
      "dist/nodes/MdToWhatsapp/MdToWhatsapp.node.js"
    ],
    "credentials": [
      "dist/credentials/MdToWhatsappApi.credentials.js"
    ]
  },
  "dependencies": {
    "n8n-workflow": "*"             ← runtime dep — types & base classes
  },
  "devDependencies": {
    "@n8n/node-cli": "*",           ← n8n-node build/dev/lint CLI
    "typescript": "5.9.3",
    "prettier": "3.8.3",
    "eslint": "*",
    "release-it": "20.2.0"
  },
  "peerDependencies": {
    "n8n-workflow": "*"             ← jangan bundle, biar n8n host yang sediakan
  }
}
```

### Field `n8n` Detail

| Field                | Wajib | Tipe       | Keterangan                                              |
| -------------------- | ----- | ---------- | ------------------------------------------------------ |
| `n8nNodesApiVersion` | ✅    | `1`        | Versi API. Saat ini hanya `1`.                         |
| `strict`             | ✅    | `true`     | Mode strict — node di-validate lebih ketat.            |
| `nodes`              | ✅    | `string[]` | Path ke file `.node.js` (hasil compile)               |
| `credentials`        | ❌    | `string[]` | Path ke file `.credentials.js` (jika ada credentials) |

> ⚠️ **Penting**: path di `n8n.nodes` dan `n8n.credentials` harus menunjuk ke
> **JavaScript hasil compile** (`dist/...`), bukan TypeScript source.

---

## 5. Anatomy of a Node File

Setiap file `.node.ts` mengikuti template ini:

```typescript
import {
  NodeConnectionTypes,
  type INodeType,
  type INodeTypeDescription,
} from 'n8n-workflow';

export class MyNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Node',                    ← nama di UI n8n
    name: 'myNode',                            ← internal ID (unique!)
    icon: { light: 'file:./my-node.svg',
            dark:  'file:./my-node.dark.svg' },
    group: ['transform'],                      ← kategori di panel
    version: 1,                                ← versi schema node INI
    subtitle: '={{$parameter["mode"]}}',       ← dinamis (expression)
    description: 'What this node does',
    defaults: { name: 'My Node' },             ← nama default saat di-drop
    usableAsTool: true,                        ← muncul sebagai AI tool
    inputs:  [NodeConnectionTypes.Main],       ← tipe input
    outputs: [NodeConnectionTypes.Main],       ← tipe output
    credentials: [                             ← (deklaratif API nodes)
      { name: 'myApi', required: true },
    ],
    requestDefaults: {                         ← (deklaratif API nodes)
      baseURL: '={{$credentials.url}}',
      headers: { Accept: 'application/json' },
    },
    properties: [ /* parameter panel schema */ ],
  };

  // Hanya untuk programmatic node:
  async execute(this: IExecuteFunctions) {
    // ...
  }
}
```

### Field `description` — Yang Wajib vs Opsional

**Wajib:**

- `displayName` — string shown in node panel & canvas
- `name` — internal unique ID. Harus unik di seluruh node yang ter-install.
  Konvensi: camelCase. Untuk menghindari konflik dengan node developer lain,
  beberapa developer menambahkan scope prefix (mis. `n8nDevMyNode`).
- `group` — kategori di panel: `['input']`, `['output']`, `['transform']`,
  `['action']`, dll.
- `version` — integer. Bump kalau kamu mengubah shape properties (breaking).
- `inputs` / `outputs` — array `NodeConnectionTypes.Main` (atau
  `Airtable`, `Postgres`, dll. untuk typed connections).
- `properties` — schema parameter panel (lihat section 9).

**Sangat disarankan:**

- `icon` — object `{ light, dark }` dengan path `file:./xxx.svg`
- `description` — 1-2 kalimat
- `defaults.name` — nama default node di canvas
- `subtitle` — expression untuk info dinamis di bawah title

---

## 6. Anatomy of a Credential File

Hanya untuk node yang call API. `MdToWhatsapp` di repo ini **tidak punya
credential** karena tidak call API.

```typescript
import type {
  IAuthenticateGeneric,
  Icon,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class MyApiApi implements ICredentialType {
  name = 'myApi';                              ← internal ID (match `credentials[].name` di node)
  displayName = 'My API';                       ← nama di UI credential
  icon: Icon = {
    light: 'file:../nodes/MyApi/my-api.svg',
    dark:  'file:../nodes/MyApi/my-api.dark.svg',
  };
  documentationUrl = '';

  // Field yang user isi di UI credential
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'url',
      type: 'string',
      default: 'https://api.example.com',
      required: true,
      description: 'The base URL of your My API server',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },          ← mask value di UI
      default: '',
      required: false,
    },
  ];

  // Cara n8n meng-attach credential ke setiap request
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',  ← expression
      },
    },
  };
}
```

### Tipe Autentikasi yang Didukung

| Tipe      | Kapan dipakai                                       |
| --------- | -------------------------------------------------- |
| `generic` | API key di header / query / body — paling fleksibel |
| `http`    | HTTP Basic / Digest Auth                            |
| `oauth2`  | OAuth 2.0 (Authorization Code, Client Credentials)  |

---

## 7. Pola A: Membangun Node Declarative (API)

Ini pola yang dihasilkan `scaffold-node.mjs`. Workflow:

### Langkah 1: Dapatkan OpenAPI Spec

```bash
export OPENAPI_URL=https://api.example.com/openapi.json
export CUSTOM_NAME=Example
export REPO_OWNER=myname
node scaffold-node.mjs
```

Script akan generate seluruh project. **Tapi kamu tidak harus pakai script
itu** — kamu bisa tulis manual. Struktur yang dihasilkan:

### Langkah 2: Struktur File yang Dihasilkan

```
nodes/Example/
├── Example.node.ts              ← main declarative node (NO execute)
├── Example.node.json            ← codex metadata
├── example.svg
├── example.dark.svg
└── resources/
    ├── index.ts                 ← re-exports
    ├── user/
    │   └── index.ts             ← userDescription: INodeProperties[]
    └── order/
        └── index.ts             ← orderDescription: INodeProperties[]
```

### Langkah 3: Main Node File (Declarative)

```typescript
import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { userDescription } from './resources/user';
import { orderDescription } from './resources/order';

export class Example implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Example',
    name: 'example',
    icon: { light: 'file:./example.svg', dark: 'file:./example.dark.svg' },
    group: ['action'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with Example API',
    defaults: { name: 'Example' },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'exampleApi', required: true }],
    requestDefaults: {
      baseURL: '={{$credentials.url}}',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    properties: [
      // Resource selector
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataAppend: true,
        options: [
          { name: 'User', value: 'user' },
          { name: 'Order', value: 'order' },
        ],
        default: 'user',
      },
      // Spread semua resource descriptions
      ...userDescription,
      ...orderDescription,
    ],
  };
}
```

### Langkah 4: Resource Description File

`resources/user/index.ts`:

```typescript
import type { INodeProperties } from 'n8n-workflow';

export const userDescription: INodeProperties[] = [
  // Operation selector (hanya muncul saat resource=user)
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataAppend: true,
    displayOptions: { show: { resource: ['user'] } },
    options: [
      {
        name: 'Get',
        value: 'get',
        action: 'Get a user',
        routing: {
          request: { method: 'GET', url: '/users/{{$parameter.userId}}' },
        },
      },
      {
        name: 'Create',
        value: 'create',
        action: 'Create a user',
        routing: {
          request: { method: 'POST', url: '/users' },
        },
      },
    ],
    default: 'get',
  },
  // Field untuk operation=get
  {
    displayName: 'User ID',
    name: 'userId',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        resource: ['user'],
        operation: ['get'],
      },
    },
    default: '',
    routing: {
      // Bagaimana field ini dipetakan ke request
      // (untuk URL params, query, body, dll.)
    },
  },
];
```

### Kunci Pola Declarative

1. **Tidak ada `execute()`** — n8n membaca `routing` di setiap operation option
   dan mengkonstruksi HTTP request secara otomatis.
2. **`requestDefaults`** menyediakan baseURL & default headers untuk semua
   request. Bisa di-override per operation via `routing.request`.
3. **`displayOptions.show`** mengontrol field mana yang muncul berdasarkan
   resource & operation yang dipilih.
4. **`routing`** adalah bahasa deklaratif untuk memetakan parameter ke HTTP
   request (URL path, query string, body field, headers).

---

## 8. Pola B: Membangun Node Programmatic (Transform)

Ini pola yang dipakai `MdToWhatsapp` di repo ini. Lengkapinya:

- [`nodes/MdToWhatsapp/MdToWhatsapp.node.ts`](nodes/MdToWhatsapp/MdToWhatsapp.node.ts) —
  node utama dengan `execute()`
- [`nodes/MdToWhatsapp/GenericFunctions.ts`](nodes/MdToWhatsapp/GenericFunctions.ts) —
  pure function untuk conversion logic

### Kunci Pola Programmatic

1. **`execute()` wajib** — signature:
   ```typescript
   async execute(this: IExecuteFunctions): Promise<NodeExecutionWithMetadata[][]>
   ```
2. **`this.getInputData()`** — ambil array input items
3. **`this.getNodeParameter(name, itemIndex, defaultValue)`** — baca parameter UI
4. **Return `[items]`** — array of arrays. Outer array = 1 entry per output
   (kita hanya punya 1 output → `[items]`)
5. **`pairedItem: { item: i }`** WAJIB di setiap output item — n8n pakai ini
   untuk tracking retry/error mapping
6. **Throw `NodeApiError`** untuk user-facing errors (input tidak valid, dll.)

### Template Minimal

```typescript
import {
  NodeApiError,
  NodeConnectionTypes,
  type IExecuteFunctions,
  type INodeType,
  type INodeTypeDescription,
  type NodeExecutionWithMetadata,
} from 'n8n-workflow';

export class MyTransform implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Transform',
    name: 'myTransform',
    group: ['transform'],
    version: 1,
    defaults: { name: 'My Transform' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName: 'Input Field',
        name: 'inputField',
        type: 'string',
        default: 'data',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<NodeExecutionWithMetadata[][]> {
    const items = this.getInputData();
    const inputField = this.getNodeParameter('inputField', 0) as string;

    const result: NodeExecutionWithMetadata[] = [];

    for (let i = 0; i < items.length; i++) {
      const value = items[i].json[inputField];

      if (value === undefined) {
        throw new NodeApiError(this.getNode(), {
          message: `Field "${inputField}" not found on item ${i}`,
        });
      }

      // Transform value
      const transformed = String(value).toUpperCase();

      result.push({
        json: { ...items[i].json, transformed },
        pairedItem: { item: i },
      });
    }

    return [result];
  }
}
```

---

## 9. Properties System — Schema Parameter UI

Setiap entry di array `properties` adalah satu field di parameter panel n8n.
Tipe field ditentukan oleh `type`:

### Tipe Field yang Sering Dipakai

| `type`         | UI Element               | Output type        |
| -------------- | ----------------------- | ------------------ |
| `string`       | Text input              | string             |
| `number`       | Number input            | number             |
| `boolean`      | Toggle switch           | boolean            |
| `options`      | Dropdown select         | string (value)     |
| `multiOptions` | Multi-select dropdown   | string[]           |
| `collection`   | Collapsible group       | object             |
| `fixedCollection` | Fixed-key group      | object             |
| `json`         | JSON editor             | object             |
| `string` + `typeOptions.rows` | Textarea  | string             |
| `dateTime`     | Date picker             | string (ISO)       |
| `hidden`       | Tidak tampil di UI      | any                |

### Field Wajib per Property

```typescript
{
  displayName: 'My Field',        // ← label di UI
  name: 'myField',                // ← key di output JSON
  type: 'string',                 // ← tipe UI
  default: '',                    // ← nilai default
  // required: true,              // ← optional, wajib diisi user
  // description: 'Help text',    // ← optional, tooltip
  // placeholder: 'Hint...',      // ← optional
  // typeOptions: { ... },        // ← optional, tipe-specific config
  // displayOptions: { ... },     // ← optional, conditional visibility
  // routing: { ... },            // ← optional (declarative), request mapping
}
```

### `typeOptions` yang Umum

```typescript
// Textarea
{ type: 'string', typeOptions: { rows: 8 } }

// Password field (mask value)
{ type: 'string', typeOptions: { password: true } }

// Number with min/max
{ type: 'number', typeOptions: { min: 0, max: 100 } }
```

---

## 10. Display Options — Conditional UI

Mekanisme untuk menampilkan field hanya jika resource / operation tertentu
dipilih:

```typescript
{
  displayName: 'User ID',
  name: 'userId',
  type: 'string',
  displayOptions: {
    show: {
      resource: ['user'],         // ← hanya muncul saat resource=user
      operation: ['get', 'delete'], // ← dan operation=get ATAU delete
    },
  },
  default: '',
}
```

### Multiple Values = AND

Di dalam `show`, semua key harus match. Jadi `resource: ['user']` AND
`operation: ['get', 'delete']` artinya "muncul saat resource=user DAN operation
salah satu dari get/delete".

### `hide` (Inverse)

```typescript
displayOptions: {
  hide: {
    resource: ['user'],  // ← sembunyikan saat resource=user
  },
}
```

---

## 11. Routing & Request Metadata (Declarative)

Untuk node declarative, `routing` di operation option memberitahu n8n request
HTTP apa yang harus dikirim:

```typescript
{
  name: 'Get User',
  value: 'get',
  action: 'Get a user',
  routing: {
    request: {
      method: 'GET',
      url: '/users/{{$parameter.userId}}',  // ← expression di URL
    },
  },
}
```

### Routing di Field (Parameter Mapping)

Field-level routing memberitahu n8n bagaimana value field dimasukkan ke
request:

```typescript
{
  displayName: 'Name',
  name: 'name',
  type: 'string',
  routing: {
    request: {
      body: { // ← masukkan ke request body
        post: ['name'], // ← sebagai field "name" di body POST
      },
    },
  },
}
```

### Lokasi Routing yang Umum

| Lokasi            | Field di `routing`        | Contoh                                |
| ----------------- | ------------------------- | ------------------------------------- |
| URL path          | `routing.request.url`     | `/users/{{$parameter.id}}`            |
| Query string      | `routing.request.qs`      | `{ limit: '={{$parameter.limit}}' }`  |
| Request body      | `routing.request.body`    | `{ name: '={{$parameter.name}}' }`    |
| Headers           | `routing.request.headers` | `{ 'X-Custom': '={{$parameter.x}}' }` |
| Field-to-body map | `routing.request.body.post` | `['fieldName']`                     |

---

## 12. Expressions & Templating

n8n pakai syntax `={{ ... }}` untuk expression. Expression bisa mengakses:

- `{{$parameter.fieldName}}` — value dari field node ini
- `{{$credentials.fieldName}}` — value dari credential
- `{{$json.fieldName}}` — field dari input item (di field-level expressions)
- `{{$node["NodeName"].json.field}}` — output node lain
- `{{$now}}` — timestamp sekarang
- `{{$workflow.id}}` — workflow metadata

### Contoh di `subtitle`

```typescript
subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}'
```

Hasil di canvas: `get: user` (dinamis sesuai pilihan user).

### Contoh di `requestDefaults.baseURL`

```typescript
requestDefaults: {
  baseURL: '={{$credentials.url}}',  // ← ambil dari credential
}
```

---

## 13. Icons

### Format

- **SVG** (disarankan) — scalable, kecil, bisa di-style
- **PNG** — boleh tapi lebih besar
- **JPG** — tidak disarankan (no transparency)

### Spesifikasi

- Ukuran viewBox: `60x60` pixels
- Selalu **berpasangan**: light variant (`xxx.svg`) + dark variant
  (`xxx.dark.svg`)
- Disimpan di folder node yang sama: `nodes/MyClass/my-class.svg`

### Template SVG Placeholder

```xml
<!-- Light variant -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" fill="none">
  <rect width="60" height="60" rx="12" fill="#25D366"/>
  <text x="30" y="36" text-anchor="middle" fill="white"
        font-family="Arial,sans-serif" font-size="14" font-weight="bold">MD</text>
</svg>
```

### Referensi di Node File

```typescript
icon: {
  light: 'file:./my-class.svg',
  dark:  'file:./my-class.dark.svg',
}
```

> `file:./` adalah prefix yang memberitahu n8n untuk load file relatif terhadap
> file `.node.js` yang sudah di-compile.

---

## 14. Codex Metadata (`*.node.json`)

File `<NodeName>.node.json` di folder node adalah metadata untuk **n8n Codex**
(sistem kategorisasi & dokumentasi node). Tanpa file ini, node tetap jalan
tapi tidak masuk katalog n8n dengan benar.

```json
{
  "node": "mdToWhatsapp",
  "nodeVersion": "1.0",
  "codexVersion": "1.0",
  "categories": ["Data Transformation", "Communication"],
  "resources": {
    "primaryDocumentation": [
      { "url": "https://github.com/..." }
    ],
    "credentialDocumentation": [
      { "url": "https://github.com/...#credentials" }
    ]
  }
}
```

### Categories yang Umum

- `Data Transformation`
- `Communication`
- `Development`
- `Productivity`
- `Sales`
- `Marketing`
- `Finance`
- `AI`
- `Action` (untuk API action nodes)

---

## 15. Build, Test, Publish

### Build

```bash
npm install
npm run build         # atau: npx tsc
```

Hasil: folder `dist/` berisi file `.js`, `.js.map`, `.d.ts`.

### Local Test (di n8n dev environment)

Cara paling cepat: pakai `n8n-node dev` (jika `@n8n/node-cli` terinstall):

```bash
npm run dev
```

Atau manual: link package ke n8n installation:

```bash
# Di folder node package
npm link

# Di folder n8n installation
npm link n8n-nodes-md-to-whatsapp

# Jalankan n8n
npx n8n
```

Lalu di UI n8n: **Settings → Community Nodes → Install from npm** → masukkan
nama package. Atau untuk dev, n8n akan auto-detect package yang sudah
di-link.

### Test Logic (Unit Test)

Untuk logic yang complex (seperti `convertMarkdownToWhatsapp`), tulis test
terpisah. Contoh di repo ini:
[`scripts/test-converter.mjs`](scripts/test-converter.mjs) — sanity test cepat.

Untuk test yang lebih serious, pakai Jest atau Vitest:

```bash
npm install --save-dev vitest
```

```typescript
// test/converter.test.ts
import { convertMarkdownToWhatsapp } from '../nodes/MdToWhatsapp/GenericFunctions';
import { describe, it, expect } from 'vitest';

describe('convertMarkdownToWhatsapp', () => {
  it('converts bold', () => {
    expect(convertMarkdownToWhatsapp('**bold**')).toBe('*bold*');
  });
  it('converts headings', () => {
    expect(convertMarkdownToWhatsapp('# Title')).toBe('*Title*');
  });
});
```

### Publish ke npm

```bash
npm run build
npm version patch    # atau minor / major
npm publish
```

Setelah publish, user bisa install via UI n8n:
**Settings → Community Nodes → Install → `n8n-nodes-md-to-whatsapp`**.

---

## 16. Common Pitfalls

Pitfall yang sudah ketemu saat membangun node `MdToWhatsapp` di repo ini:

### Pitfall 1: `noUnusedLocals` strict

`tsconfig.json` mengaktifkan `noUnusedLocals: true`. Import type yang tidak
dipakai akan **error compile**. Hapus import yang tidak terpakai.

```typescript
// ❌ Error: 'INodeProperties' is declared but never used
import { type INodeProperties } from 'n8n-workflow';
```

### Pitfall 2: `pairedItem` wajib di output items

Versi `n8n-workflow` modern mensyaratkan setiap output item punya field
`pairedItem` untuk tracking. Formatnya object, BUKAN number:

```typescript
// ❌ Type error: Type 'number' is not assignable to 'IPairedItemData'
returnItems.push({ json: {...}, pairedItem: 0 });

// ✅ Correct
returnItems.push({ json: {...}, pairedItem: { item: 0 } });
```

### Pitfall 3: `noDataAppend` tidak ada di semua versi

Beberapa property field lama mendukung `noDataAppend: true` untuk mencegah
value ikut masuk ke output JSON. Tapi ini **tidak ada di type definition
terbaru**. Hapus saja jika tidak diperlukan.

### Pitfall 4: Urutan Regex untuk Markdown → WhatsApp

Saat mengkonversi `**bold**` (MD) → `*bold*` (WA) dan `*italic*` (MD) →
`_italic_` (WA):

- ❌ **Salah**: Bold dulu, baru italic. Karena output bold (`*text*`) akan
  dikenali sebagai italic markdown oleh regex italic berikutnya, lalu
  dikonversi jadi `_text_`.
- ✅ **Benar**: Italic dulu (dengan negative lookbehind `(?<!\*)` supaya
  tidak konsumsi `**`), baru bold.

Lihat implementasi di
[`GenericFunctions.ts`](nodes/MdToWhatsapp/GenericFunctions.ts) section 4c–4d.

### Pitfall 5: Heading output kena re-process inline

`# Heading` diubah jadi `*Heading*` (WA bold). Tapi regex italic melihat
`*Heading*` dan mengira itu italic markdown → konversi jadi `_Heading_`.

Fix: pakai **placeholder token** tanpa karakter `*`, simpan `*Heading*` di
array, restore setelah inline transforms selesai. Lihat implementasi di
[`GenericFunctions.ts`](nodes/MdToWhatsapp/GenericFunctions.ts) section 3b & 5b.

### Pitfall 6: Path `n8n.nodes` di `package.json` harus `.js` bukan `.ts`

```json
// ❌ Salah
"nodes": ["nodes/MdToWhatsapp/MdToWhatsapp.node.ts"]

// ✅ Benar (hasil compile)
"nodes": ["dist/nodes/MdToWhatsapp/MdToWhatsapp.node.js"]
```

### Pitfall 7: `name` field harus unique global

Kalau dua package punya node dengan `name: 'myApi'`, salah satu akan
diabaikan n8n. Konvensi: tambahkan scope prefix, mis.
`name: 'myScopeMyApi'`.

---

## 17. Sumber Belajar Lanjutan

### Resmi n8n

- **n8n Documentation** — https://docs.n8n.io/integrations/creating-nodes/
- **n8n-nodes-starter** (template resmi) — https://github.com/n8n-io/n8n-nodes-starter
- **n8n-workflow types** — https://github.com/n8n-io/n8n/tree/master/packages/workflow

### Referensi Implementasi

- **Repo ini** (`n8n-nodes-md-to-whatsapp`) — contoh programmatic transform node
- **n8n-nodes-base** — https://github.com/n8n-io/n8n/tree/master/nodes/packages/nodes-base
  (ratusan node resmi, baca source-nya untuk belajar pola)
- **kelvinzer0/n8n-openapi-node-ultimate** — https://github.com/kelvinzer0/n8n-openapi-node-ultimate
  (scaffold script untuk generate declarative API node dari OpenAPI spec)

### Komunitas

- **n8n Community Forum** — https://community.n8n.io/
- **n8n Discord** — https://discord.gg/cyB3Ajgt8M

### Tools

- **@n8n/node-cli** — CLI resmi untuk build/dev/lint/release node package
- **n8n-nodes-starter** — template project untuk mulai dari nol

---

## Ringkasan

| Pertanyaan                          | Jawaban Singkat                                    |
| ----------------------------------- | ------------------------------------------------- |
| Kapan pakai declarative?            | Saat node call HTTP API (ada OpenAPI spec → generate) |
| Kapan pakai programmatic?           | Saat node transform data, parse file, atau protocol non-HTTP |
| Apa field wajib di `description`?   | `displayName`, `name`, `group`, `version`, `inputs`, `outputs`, `properties` |
| Apa field wajib di `package.json`?  | `n8n.n8nNodesApiVersion`, `n8n.strict`, `n8n.nodes` |
| Bagaimana publish?                  | `npm publish` setelah `npm run build`. User install via UI n8n. |
| Bagaimana debug?                    | `.vscode/launch.json` attach ke proses n8n yang running |

Selamat membangun node n8n! 🚀

---

*Panduan ini ditulis berdasarkan source code `scaffold-node.mjs` (1398 baris)
dari `kelvinzer0/n8n-openapi-node-ultimate` dan implementasi nyata node
`MdToWhatsapp` di repo ini. Untuk pertanyaan lanjutan, baca source code
kedua file tersebut secara langsung.*
