export interface HomeSection {
  id: string;
  name: string;
  description: string;
  count: number;
}

export function renderHomePage(
  sections: readonly HomeSection[],
  options?: { linkFor?: (id: string) => string | undefined; secondary?: { id: string; label: string } },
): string;
