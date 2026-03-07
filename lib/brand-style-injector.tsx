"use client";

import { useTeam } from "./team-context";

/** Only allow valid hex color values to prevent CSS injection */
function sanitizeColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

/**
 * Injects CSS custom properties for brand colors onto :root
 * so that Tailwind utilities (and raw CSS) can reference them.
 */
export function BrandStyleInjector() {
  const { branding } = useTeam();

  const primary = sanitizeColor(branding.primaryColor, "#1c759e");
  const primaryDark = sanitizeColor(branding.primaryDark, "#155f82");
  const primaryLight = sanitizeColor(branding.primaryLight, "#2a8fc0");
  const secondary = sanitizeColor(branding.secondaryColor, "#272727");

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root {
  --brand-primary: ${primary};
  --brand-primary-dark: ${primaryDark};
  --brand-primary-light: ${primaryLight};
  --brand-secondary: ${secondary};
}`,
      }}
    />
  );
}
