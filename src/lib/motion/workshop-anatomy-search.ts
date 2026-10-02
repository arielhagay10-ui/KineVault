import { muscleGroups, type MuscleOption } from "./anatomy";

const areas = [
  { terms: "shoulder shoulders", pattern: /deltoid|supraspinatus|infraspinatus|teres/ },
  { terms: "upper arm arms", pattern: /biceps_brachii|triceps_brachii|brachialis|coracobrachialis/ },
  { terms: "back upper back traps", pattern: /trapezius|latissimus|rhomboid|erector|multifidus/ },
  { terms: "chest pecs", pattern: /pectoralis/ },
  { terms: "belly tummy stomach abs core abdomen", pattern: /abdom|oblique/ },
  { terms: "butt bottom hips glutes", pattern: /gluteus/ },
  { terms: "thigh thighs front leg quads", pattern: /rectus_femoris|vastus/ },
  { terms: "thigh thighs back leg hamstrings", pattern: /biceps_femoris|semitendinosus|semimembranosus/ },
  { terms: "lower leg calf calves", pattern: /gastrocnemius|soleus/ },
  { terms: "forearm forearms wrist wrists", pattern: /carpi|pronator|supinator|brachioradialis/ },
] as const;

export function searchAnatomy(muscles: MuscleOption[], query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (label: string, id: string) => {
    const formal = `${label} ${id}`.toLowerCase().replaceAll("_", " ");
    const aliases = areas.filter(area => area.pattern.test(id.toLowerCase())).map(area => area.terms).join(" ");
    return tokens.every(token => `${formal} ${aliases}`.includes(token));
  };
  return { groups: muscleGroups.filter(group => {
    const aliases = areas.filter(area => area.pattern.test(group.pattern.source)).map(area => area.terms).join(" ");
    return tokens.every(token => `${group.label.toLowerCase()} ${aliases}`.includes(token));
  }), individual: muscles.filter(item => matches(item.label, item.id)) };
}
