# Muscle suggestions

Private exercise details now offer **Suggest working muscles** inside **Anatomy**. This is a deterministic anatomy aid. It does not load the research model.

## Authoring flow

1. Choose a resistance source and grip under **Description, equipment and classifications**.
2. Select the exercise's anatomical joint actions in **Anatomy**.
3. Confirm which selected actions work against resistance.
4. Read each candidate's explanation and anatomy reference, choose a role, and add it.
5. Save privately using the existing form.

During a controlled return, retain the loaded action. Lowering a curl does not by itself establish resisted elbow extension. Selecting opposing actions requires separate loading review, so that pair stays unknown in this first version.

Existing muscle choices and roles are preserved. Accepted candidates enter the normal editable fields and use the existing validation, recovery and private save flow. Each muscle can have one role. Suggestions never mark classifications verified, publish content, assign confidence or change public snapshots. Source references support anatomical actions, not a complete exercise-specific muscle assessment.

The saved motion preview in **My exercises** loads the saved muscle classifications and highlights them together. Secondary muscles use a lighter coral highlight. Deltoid heads map separately. When no muscles are classified, this preview leaves highlights off. An authored highlight is preserved when present; the preview's Highlight menu also offers **Saved working muscles** and **None** for manual exploration.

## Rules and limits

`src/lib/private-exercises/muscle-suggestions.ts` validates inputs with Zod and returns candidates, reasons, reference links, unsupported actions and uncertainty notes. The first version covers twelve shoulder, elbow, hip, knee and ankle actions using the existing normalized taxonomy. Contributors shared by several actions appear once with all reasons.

Grip, body position and resistance source provide context for review. They do not supply force vectors or validated muscle rankings. Knee movement makes hamstring involvement from hip extension uncertain, so that candidate needs separate review. Missing taxonomy entries and unsupported actions stay unknown. A missing suggestion never means inactive.

This version deliberately requires authors to identify and confirm anatomical actions. It does not infer actions from animation Euler angles. It does not compute joint torques, machine mechanics, stabilizer requirements, activation percentages, muscle force or exhaustive binary muscle masks. Rules identify possible contributors, and authors choose exercise-wide primary, secondary or stabilizer roles. Known saved classifications remain the starting point.

The UI lives in `src/components/private-exercises/muscle-suggestions.tsx`. Resistance source and grip moved from advanced fields into the main classification section without changing saved field names or schemas. Changes to joint actions or setup reset the loading confirmations and unaccepted role choices; accepted muscle selections remain editable.

## Anatomy references

- [OpenStax, Anatomy and Physiology 2e, upper limbs](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs).
- [OpenStax, Anatomy and Physiology 2e, lower limbs](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs).

Rule explanations are original summaries. `BIOMECHANICS.md` remains the authority for the separation between muscles, anatomical joint actions and rig poses.
