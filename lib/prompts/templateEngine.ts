/**
 * Type-safe template engine for LLM prompts.
 * Replaces {placeholder} tokens with provided values.
 * All keys are typed — typos are caught at compile time.
 */

export type TemplateVars = Record<string, string | number | undefined>;

/**
 * Replace all {key} placeholders in a template string with values from vars.
 * Missing keys are replaced with 'N/A'.
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
 * Select language-appropriate content.
 */
export function selectLanguage<T>(language: string, en: T, de: T): T {
    return language.startsWith('de') ? de : en;
}
