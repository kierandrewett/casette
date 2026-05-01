// Curated subset of ISO 3166-1 alpha-2 country codes surfaced in the
// studio's channel-details form. The DB column accepts any valid two-letter
// code, so admins can backfill anything outside this list via raw SQL; the
// form intentionally surfaces a small, ordered set rather than a 250-item
// dropdown.
export interface CountryOption {
    code: string;
    name: string;
}

export const COUNTRY_OPTIONS: CountryOption[] = [
    { code: "GB", name: "United Kingdom" },
    { code: "US", name: "United States" },
    { code: "CA", name: "Canada" },
    { code: "AU", name: "Australia" },
    { code: "NZ", name: "New Zealand" },
    { code: "IE", name: "Ireland" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "ES", name: "Spain" },
    { code: "IT", name: "Italy" },
    { code: "NL", name: "Netherlands" },
    { code: "SE", name: "Sweden" },
    { code: "NO", name: "Norway" },
    { code: "FI", name: "Finland" },
    { code: "DK", name: "Denmark" },
    { code: "JP", name: "Japan" },
    { code: "KR", name: "South Korea" },
    { code: "IN", name: "India" },
    { code: "BR", name: "Brazil" },
    { code: "MX", name: "Mexico" },
    { code: "ZA", name: "South Africa" },
];

export const isKnownCountry = (code: string | null | undefined): boolean => {
    if (!code) return false;
    return COUNTRY_OPTIONS.some((c) => c.code === code.toUpperCase());
};
