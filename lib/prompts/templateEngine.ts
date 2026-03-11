/**
 * Type-safe template engine for LLM prompts.
 *
 * Replaces `{placeholder}` tokens with provided values and provides
 * a language selection helper used across all prompt modules.
 * All keys are typed so that typos are caught at compile time.
 * @module
 */

/** Map of placeholder names to their replacement values. */
export type TemplateVars = Record<string, string | number | undefined>;

/**
 * Replace all `{key}` placeholders in a template string with values from `vars`.
 * Missing keys are replaced with `'N/A'`; numbers are formatted to 2 decimal places.
 * @param template - The template string containing `{key}` placeholders.
 * @param vars - Key-value pairs for substitution.
 * @returns The fully interpolated string.
 */
export function fillTemplate(template: string, vars: TemplateVars): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => {
        const value = vars[key];
        if (value === undefined || value === null) return 'N/A';
        if (typeof value === 'number') return value.toFixed(2);
        return String(value);
    });
}

/**
 * Select language-appropriate content based on a BCP-47 language tag.
 * Returns the German variant when the tag starts with `'de'`, English otherwise.
 * @param language - BCP-47 language tag (e.g. `'en-US'`, `'de-CH'`).
 * @param en - English content.
 * @param de - German content.
 * @returns The content matching the detected language.
 */
export function selectLanguage<T>(language: string, en: T, de: T): T {
    return language.startsWith('de') ? de : en;
}
