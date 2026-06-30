import {
        NodeApiError,
        NodeConnectionTypes,
        type IExecuteFunctions,
        type INodeType,
        type INodeTypeDescription,
        type NodeExecutionWithMetadata,
} from 'n8n-workflow';
import { convertMarkdownToWhatsapp, DEFAULT_OPTIONS, type ConvertOptions } from './GenericFunctions';

/**
 * MdToWhatsapp.node.ts
 *
 * PROGRAMMATIC NODE EXAMPLE (Type 2 in n8n taxonomy).
 *
 * Unlike declarative API nodes (which only describe HTTP requests and let
 * n8n execute them), programmatic nodes implement the `execute()` method
 * themselves. This is the right pattern whenever the node does NOT just call
 * an HTTP API — for example:
 *   - data transformation (this node)
 *   - file parsing
 *   - calling a non-HTTP protocol (gRPC, WebSocket, MQTT)
 *   - running local code (ffmpeg, sharp, etc.)
 *
 * Anatomy of a programmatic node:
 *   1. `description` field declares metadata + UI properties (same as declarative)
 *   2. `execute()` is called by n8n at runtime with the item stream
 *   3. Inside execute(), we read parameters, do work, and return items
 */

export class MdToWhatsapp implements INodeType {
        /**
         * `description` is read by n8n at load time to build the node's UI,
         * generate the parameter panel, and route execution.
         *
         * Required fields:
         *   - displayName : shown in the node panel and the canvas
         *   - name        : internal unique identifier (must be unique across all installed nodes)
         *   - group       : categorises the node in the panel ("transform", "input", "output", ...)
         *   - version     : integer version of THIS node's schema (bump when properties change shape)
         *   - inputs / outputs : connection types — for transformation nodes, Main → Main
         *
         * Optional but recommended:
         *   - subtitle    : dynamic text under the node title (uses expressions)
         *   - description : short pitch shown in the panel
         *   - defaults    : default node name when dropped on canvas
         *   - icon        : light/dark SVG icons
         *   - properties  : the parameter panel schema (see below)
         */
        description: INodeTypeDescription = {
                displayName: 'Markdown to WhatsApp',
                name: 'mdToWhatsapp',
                icon: { light: 'file:./md-to-whatsapp.svg', dark: 'file:./md-to-whatsapp.dark.svg' },
                group: ['transform'],
                version: 1,
                subtitle: '={{$parameter["mode"] === "json" ? "JSON mode" : "Text mode"}}',
                description: 'Convert Markdown text into WhatsApp-compatible formatting',
                defaults: { name: 'Markdown to WhatsApp' },
                usableAsTool: true,
                inputs: [NodeConnectionTypes.Main],
                outputs: [NodeConnectionTypes.Main],
                // Note: no `credentials` field — this node does not call any external API.
                // Note: no `requestDefaults` field — this node is not declarative.
                properties: [
                        {
                                displayName: 'Mode',
                                name: 'mode',
                                type: 'options',
                                options: [
                                        {
                                                name: 'Text',
                                                value: 'text',
                                                description: 'Convert a Markdown string provided in the field below',
                                        },
                                        {
                                                name: 'JSON Field',
                                                value: 'json',
                                                description: 'Convert the Markdown string found at a JSON path of each input item',
                                        },
                                ],
                                default: 'text',
                                description: 'Whether to use a single Markdown string or read it from input items',
                        },
                        {
                                displayName: 'Markdown',
                                name: 'markdown',
                                type: 'string',
                                typeOptions: {
                                        rows: 8,
                                },
                                displayOptions: {
                                        show: {
                                                mode: ['text'],
                                        },
                                },
                                default: '',
                                placeholder: '# Hello\n\nThis is **bold** and _italic_.',
                                description: 'The Markdown text to convert',
                        },
                        {
                                displayName: 'Field Name',
                                name: 'fieldName',
                                type: 'string',
                                displayOptions: {
                                        show: {
                                                mode: ['json'],
                                        },
                                },
                                default: 'markdown',
                                placeholder: 'markdown',
                                description: 'JSON path of the field on each input item that contains the Markdown text',
                        },
                        {
                                displayName: 'Destination Field',
                                name: 'destination',
                                type: 'string',
                                displayOptions: {
                                        show: {
                                                mode: ['json'],
                                        },
                                },
                                default: 'whatsapp',
                                placeholder: 'whatsapp',
                                description: 'Name of the output field that will receive the converted WhatsApp text',
                        },
                        {
                                displayName: 'Options',
                                name: 'options',
                                type: 'collection',
                                placeholder: 'Add option',
                                default: {},
                                options: [
                                        {
                                                displayName: 'Trim Trailing Whitespace',
                                                name: 'trimLines',
                                                type: 'boolean',
                                                default: true,
                                                description: 'Whether to remove trailing whitespace on each line',
                                        },
                                        {
                                                displayName: 'Convert Headings to Bold',
                                                name: 'convertHeadings',
                                                type: 'boolean',
                                                default: true,
                                                description: 'Whether to convert # / ## / ### headings into *bold*',
                                        },
                                        {
                                                displayName: 'Convert Links',
                                                name: 'convertLinks',
                                                type: 'boolean',
                                                default: true,
                                                description: 'Whether to convert [text](url) into "text (url)"',
                                        },
                                        {
                                                displayName: 'Convert List Bullets',
                                                name: 'convertBullets',
                                                type: 'boolean',
                                                default: true,
                                                description: 'Whether to convert -, *, + list markers into WhatsApp • bullets',
                                        },
                                        {
                                                displayName: 'Drop Horizontal Rules',
                                                name: 'dropHorizontalRule',
                                                type: 'boolean',
                                                default: true,
                                                description: 'Whether to remove --- / *** horizontal rules (WhatsApp has no equivalent)',
                                        },
                                ],
                        },
                ],
        };

        /**
         * The execute method is the heart of a programmatic node.
         *
         * Contract:
         *   - Receives `this: IExecuteFunctions` which exposes helpers for reading
         *     parameters, items, credentials, and making requests.
         *   - Returns an array of arrays of items. The outer array has one entry
         *     per output; since we only declared one output, we return `[items]`.
         *
         * Error handling:
         *   - Throw `NodeOperationError` for user-facing errors (bad input, missing
         *     field, etc.). n8n will surface these in the UI nicely.
         *   - Let unexpected exceptions propagate — n8n wraps them automatically.
         *
         * Throughput:
         *   - For "JSON mode", we process every input item so the node streams
         *     naturally (10 input items → 10 output items).
         *   - For "Text mode", we emit exactly one item regardless of input count.
         */
        async execute(this: IExecuteFunctions): Promise<NodeExecutionWithMetadata[][]> {
                const items = this.getInputData();
                const mode = this.getNodeParameter('mode', 0) as 'text' | 'json';
                const optionsRaw = this.getNodeParameter('options', 0, {}) as Partial<ConvertOptions>;

                // Merge user-provided options with defaults. We only override keys the
                // user actually set, so undefined → fall back to DEFAULT_OPTIONS.
                const options: ConvertOptions = {
                        ...DEFAULT_OPTIONS,
                        ...optionsRaw,
                };

                const returnItems: NodeExecutionWithMetadata[] = [];

                if (mode === 'text') {
                        // Single-shot conversion: read the Markdown string from the parameter
                        // panel and emit one item. Useful when the workflow just needs to
                        // convert a static document.
                        const markdown = this.getNodeParameter('markdown', 0, '') as string;
                        const whatsapp = convertMarkdownToWhatsapp(markdown, options);

                        returnItems.push({
                                json: {
                                        whatsapp,
                                        length: whatsapp.length,
                                        source: 'parameter',
                                },
                                pairedItem: { item: 0 },
                        });
                } else {
                        // Streaming conversion: iterate over every input item, read the
                        // Markdown string from a configurable JSON path, and write the
                        // converted text into a new field on the SAME item (preserving
                        // all other fields).
                        const fieldName = (this.getNodeParameter('fieldName', 0, 'markdown') as string).trim();
                        const destination = (this.getNodeParameter('destination', 0, 'whatsapp') as string).trim();

                        if (!fieldName) {
                                throw new NodeApiError(this.getNode(), {
                                        message: 'Field Name is required in JSON mode',
                                        description: 'Specify the input field that contains the Markdown text to convert.',
                                });
                        }

                        for (let i = 0; i < items.length; i++) {
                                const item = items[i];
                                const sourceValue = item.json[fieldName];

                                if (sourceValue === undefined || sourceValue === null) {
                                        // Pass through items that don't have the source field — better
                                        // than crashing the whole run because one row is malformed.
                                        returnItems.push({
                                                json: {
                                                        ...item.json,
                                                        [destination]: '',
                                                        _error: `Field "${fieldName}" is missing on this item`,
                                                },
                                                pairedItem: { item: i },
                                        });
                                        continue;
                                }

                                if (typeof sourceValue !== 'string') {
                                        // Coerce non-strings to string so the node is forgiving with
                                        // numbers / booleans coming from upstream nodes.
                                        returnItems.push({
                                                json: {
                                                        ...item.json,
                                                        [destination]: convertMarkdownToWhatsapp(String(sourceValue), options),
                                                        _warning: `Field "${fieldName}" was not a string — coerced via String()`,
                                                },
                                                pairedItem: { item: i },
                                        });
                                        continue;
                                }

                                const whatsapp = convertMarkdownToWhatsapp(sourceValue, options);
                                returnItems.push({
                                        json: {
                                                ...item.json,
                                                [destination]: whatsapp,
                                        },
                                        pairedItem: { item: i },
                                });
                        }
                }

                return [returnItems];
        }
}
