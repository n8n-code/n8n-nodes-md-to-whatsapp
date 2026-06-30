/**
 * GenericFunctions.ts
 *
 * Pure utility functions that convert Markdown text into WhatsApp-compatible
 * formatting. Kept separate from the node class so the conversion logic can
 * be unit-tested in isolation and reused by other nodes if needed.
 *
 * WhatsApp formatting reference:
 *   https://faq.whatsapp.com/539178204879377
 *
 * Supported mappings:
 *   Markdown                →  WhatsApp
 *   -------------------------------------------------
 *   **bold** / __bold__     →  *bold*
 *   *italic* / _italic_     →  _italic_
 *   ~~strike~~              →  ~strike~
 *   `inline code`           →  `inline code`   (same syntax)
 *   ```fenced block```      →  ```fenced block``` (same syntax)
 *   # Heading               →  *Heading*       (bold, level 1-3)
 *   [text](url)             →  text (url)
 *   ![alt](url)             →  alt (url)
 *   - item / * item         →  • item          (unordered list)
 *   1. item                 →  1. item         (ordered list, preserved)
 *   > quote                 →  > quote         (preserved, WA supports it)
 *   ---  / ***              →  (removed, WA has no horizontal rule)
 *
 * Anything unrecognised is passed through unchanged so users can mix
 * Markdown with WhatsApp syntax safely.
 */

export interface ConvertOptions {
        /** Trim trailing whitespace on every line. Default: true. */
        trimLines: boolean;
        /** Convert # / ## / ### headings to *bold*. Default: true. */
        convertHeadings: boolean;
        /** Convert [text](url) → "text (url)". Default: true. */
        convertLinks: boolean;
        /** Convert unordered list markers (-, *, +) to bullet "•". Default: true. */
        convertBullets: boolean;
        /** Drop horizontal rules (--- / *** / ___). Default: true. */
        dropHorizontalRule: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
        trimLines: true,
        convertHeadings: true,
        convertLinks: true,
        convertBullets: true,
        dropHorizontalRule: true,
};

/**
 * Escape WhatsApp reserved characters that would otherwise be interpreted as
 * formatting. Useful when the user wants to display literal * _ ~ ` characters.
 *
 * Implementation note: WhatsApp does NOT use backslash escaping in the same way
 * Markdown does, but recent clients do honour zero-width joiners and Unicode
 * alternatives. For simplicity we use the Unicode look-alikes which render
 * visibly identical but bypass the formatter.
 */
export function escapeWhatsapp(input: string): string {
        return input
                .replace(/\*/g, '\u2217') // ∗ asterisk operator
                .replace(/_/g, '\u02CD') // ˘ modifier low macron
                .replace(/~/g, '\u223C') // ∼ tilde operator
                .replace(/`/g, '\u2018'); // ' left single quote
}

/**
 * Convert fenced code blocks first so that their inner content is protected
 * from subsequent Markdown transformations. We use sentinel tokens to mark
 * the protected regions, then restore them at the end.
 */
function protectCodeBlocks(input: string): { text: string; blocks: string[] } {
        const blocks: string[] = [];
        const text = input.replace(/```([\s\S]*?)```/g, (_m, content: string) => {
                const idx = blocks.length;
                blocks.push('```' + content + '```');
                return `\u0000CODEBLOCK_${idx}\u0000`;
        });
        return { text, blocks };
}

function restoreCodeBlocks(text: string, blocks: string[]): string {
        return text.replace(/\u0000CODEBLOCK_(\d+)\u0000/g, (_m, idx: string) => {
                return blocks[Number.parseInt(idx, 10)] ?? '';
        });
}

/**
 * Convert inline `code` spans. WhatsApp supports the same backtick syntax so
 * we keep them, but we still need to protect them from later * _ ~ replacement.
 */
function protectInlineCode(input: string): { text: string; spans: string[] } {
        const spans: string[] = [];
        const text = input.replace(/`([^`\n]+)`/g, (_m, content: string) => {
                const idx = spans.length;
                spans.push('`' + content + '`');
                return `\u0000INLINE_${idx}\u0000`;
        });
        return { text, spans };
}

function restoreInlineCode(text: string, spans: string[]): string {
        return text.replace(/\u0000INLINE_(\d+)\u0000/g, (_m, idx: string) => {
                return spans[Number.parseInt(idx, 10)] ?? '';
        });
}

/**
 * The main conversion routine. Operates line-by-line for block-level rules
 * (headings, lists, hr) and then runs inline rules on the remainder.
 */
export function convertMarkdownToWhatsapp(
        markdown: string,
        options: ConvertOptions = DEFAULT_OPTIONS,
): string {
        if (!markdown) return '';

        // 1. Protect code regions before touching anything else.
        const { text: protected1, blocks } = protectCodeBlocks(markdown);
        const { text: protected2, spans } = protectInlineCode(protected1);

        // 2. Normalise CRLF → LF so line-based rules behave consistently.
        let text = protected2.replace(/\r\n/g, '\n');

        // 3. Split into lines for block-level transforms.
        // IMPORTANT: we run block transforms FIRST, then inline transforms below.
        // Heading output (`*Foo*`) would otherwise be re-interpreted by the inline
        // italic pass as Markdown italic and converted to `_Foo_`. To prevent that,
        // we replace each heading with a placeholder token that contains NO `*`
        // characters at all, store the real `*Foo*` string in an array, and restore
        // the placeholders after all inline transforms have finished.
        const lines = text.split('\n');
        const outLines: string[] = [];
        const headings: string[] = [];

        for (let raw of lines) {
                const line = options.trimLines ? raw.replace(/\s+$/g, '') : raw;

                // 3a. Horizontal rule → drop entirely (keep empty line so paragraphs
                // don't merge). WhatsApp has no HR syntax.
                if (options.dropHorizontalRule && /^(\s*([-*_])\s*){3,}\s*$/.test(line)) {
                        outLines.push('');
                        continue;
                }

                // 3b. ATX-style headings: # / ## / ### → *bold*
                //     Replaced with a `*`-free placeholder so inline transforms skip it.
                if (options.convertHeadings) {
                        const headingMatch = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
                        if (headingMatch) {
                                const idx = headings.length;
                                headings.push(`*${headingMatch[2].trim()}*`);
                                outLines.push(`\u0001H${idx}\u0001H`);
                                continue;
                        }
                }

                // 3c. Unordered list bullets: - / * / + → •
                //     Only the bullet marker is replaced; the content goes through
                //     inline transforms normally.
                if (options.convertBullets) {
                        const bulletMatch = /^\s*[-*+]\s+(.+)$/.exec(line);
                        if (bulletMatch) {
                                outLines.push(`• ${bulletMatch[1].trim()}`);
                                continue;
                        }
                }

                // 3d. Ordered list items and blockquotes are passed through unchanged
                // (WhatsApp supports "1." and ">" natively).

                outLines.push(line);
        }

        text = outLines.join('\n');

        // 4. Inline transforms (operate on whole text, not per line).

        // 4a. Images: ![alt](url) → "alt (url)"
        text = text.replace(
                /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
                (_m, alt: string, url: string) => {
                        const altText = alt.trim();
                        return altText ? `${altText} (${url})` : `(${url})`;
                },
        );

        // 4b. Links: [text](url) → "text (url)"
        if (options.convertLinks) {
                text = text.replace(
                        /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
                        (_m, label: string, url: string) => {
                                return `${label.trim()} (${url})`;
                        },
                );
        }

        // 4c. Italic: *italic* or _italic_ → _italic_
        //     MUST run BEFORE bold. Reason: the bold pass turns `**text**` into
        //     `*text*` (WA bold syntax). If italic ran afterwards, it would see
        //     `*text*` and wrongly convert it to `_text_` (WA italic).
        //     The negative lookbehind/lookahead (`(?<!\*)` / `(?!\*)`) prevent
        //     matching `**bold**` as italic: the second `*` of `**` fails the
        //     lookbehind, so the regex skips it.
        text = text.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '_$1_');
        text = text.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '_$1_');

        // 4d. Bold: **bold** or __bold__ → *bold*
        //     Now safe to run: any single-* italic has been consumed already,
        //     so `**bold**` is unambiguously a bold marker.
        text = text.replace(/\*\*([^*\n]+?)\*\*/g, '*$1*');
        text = text.replace(/__([^_\n]+?)__/g, '*$1*');

        // 4e. Strikethrough: ~~strike~~ → ~strike~
        text = text.replace(/~~([^~\n]+?)~~/g, '~$1~');

        // 5. Restore protected regions.
        text = restoreInlineCode(text, spans);
        text = restoreCodeBlocks(text, blocks);

        // 5b. Restore headings — replace each `\u0001H<idx>\u0001H` placeholder
        //     with the actual `*Heading Text*` we saved earlier. This runs AFTER
        //     inline transforms so the `*` markers are safe from the italic regex.
        text = text.replace(/\u0001H(\d+)\u0001H/g, (_m, idx: string) => {
                return headings[Number.parseInt(idx, 10)] ?? '';
        });

        // 6. Collapse 3+ consecutive blank lines into 2 (WhatsApp trims anyway,
        //    but cleaner output helps debugging).
        text = text.replace(/\n{3,}/g, '\n\n');

        return text;
}
