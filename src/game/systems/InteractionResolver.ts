export type InteractionCandidate = {
  label: string;
  priority: number;
  distance: number;
  activate: () => void;
};

/** A single candidate owns both the prompt and the E press for this frame. */
export function resolveInteraction(candidates: Array<InteractionCandidate | undefined>) {
  return candidates.filter((entry): entry is InteractionCandidate => Boolean(entry))
    .sort((a, b) => a.distance - b.distance || b.priority - a.priority)[0];
}
