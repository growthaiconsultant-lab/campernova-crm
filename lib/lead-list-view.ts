/** Explicit views and agent filters take precedence over the personal default. */
export function leadListView(view: string | undefined, mine: string, agentId?: string): string {
  return view ?? (agentId ? 'todos' : mine)
}
