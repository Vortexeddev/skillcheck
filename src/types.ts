import type { Verdict } from "./analyzer.js";

export interface RegistryEntry {
  repo: string;
  description: string;
  stars: number;
  license: string | null;
  /** SPDX category bucket, or "none" when no license is declared. */
  category: string;
  verdict: Verdict;
  /** True when a LICENSE file listing was actually fetched from the repo. */
  verified?: boolean;
  pushedAt?: string | null;
  skills?: number;
  topics?: string[];
}

export interface RegistryFile {
  generated: string;
  mode?: string;
  stats?: Record<string, number>;
  entries: RegistryEntry[];
}
