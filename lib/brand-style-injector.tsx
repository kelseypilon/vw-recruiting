"use client";

import { useTeam } from "./team-context";

/**
 * Injects CSS custom properties for brand colors onto :root
 * so that Tailwind utilities (and raw CSS) can reference them.
 */
export function BrandStyleInjector() {
  const { branding } = useTeam();

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root {
  --brand-primary: ${branding.primaryColor};
  --brand-primary-dark: ${branding.primaryDark};
  --brand-primary-light: ${branding.primaryLight};
  --brand-secondary: ${branding.secondaryColor};
}`,
      }}
    />
  );
}
