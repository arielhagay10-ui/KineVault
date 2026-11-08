// Minutes each e2e spec took on a CI runner with one worker (run 42403682045).
// Refresh from the list reporter output in the CI logs when specs change a lot.
export const specMinutes = {
  "admin-management.spec.ts": 0.1, "anatomy.spec.ts": 0.3, "appearance.spec.ts": 0.1, "authentication.spec.ts": 0.2,
  "catalog-filter-layout.spec.ts": 0.1, "catalog-paging.spec.ts": 0.1, "catalog.spec.ts": 0.1,
  "community-publication.spec.ts": 0.1, "efficiency-review.spec.ts": 0.1, "favorites.spec.ts": 0.1,
  "library-navigation.spec.ts": 0.1, "local-fixture-cleanup.spec.ts": 0.1, "media-recovery.spec.ts": 0.1,
  "moderation.spec.ts": 0.1, "navigation-redesign.spec.ts": 0.2, "overlay-scrollbars.spec.ts": 0.1,
  "private-details.spec.ts": 0.1, "private-equipment-details.spec.ts": 0.1, "private-exercise.spec.ts": 0.2,
  "private-library-layout.spec.ts": 0.2, "published-catalog-lifecycle.spec.ts": 0.2, "row-and-pec-deck.spec.ts": 3.2,
  "row-height.spec.ts": 3.3, "site-simplification.spec.ts": 0.3, "studio-machines.spec.ts": 21.6, "ui-states.spec.ts": 0.1,
  "workshop-ankle-rings.spec.ts": 0.3, "workshop-audit-regressions.spec.ts": 0.9, "workshop-auto-grip.spec.ts": 2.3,
  "workshop-barbell-joints.spec.ts": 2.9, "workshop-bench.spec.ts": 3, "workshop-cable-controls.spec.ts": 0.6,
  "workshop-cable-freedom.spec.ts": 2.5, "workshop-camera-click.spec.ts": 0.4, "workshop-chest-press.spec.ts": 5,
  "workshop-controls-feedback.spec.ts": 1.2, "workshop-controls-review.spec.ts": 1, "workshop-current-moment.spec.ts": 0.6,
  "workshop-dumbbell-editing.spec.ts": 1.6, "workshop-equipment-selection.spec.ts": 0.9, "workshop-first-capture.spec.ts": 0.4,
  "workshop-frame-independence.spec.ts": 0.3, "workshop-freedom.spec.ts": 2.6, "workshop-goblet-squat.spec.ts": 0.8,
  "workshop-grip-edit.spec.ts": 3.4, "workshop-improvements.spec.ts": 1, "workshop-interface-cleanup.spec.ts": 1.1,
  "workshop-joint-contacts.spec.ts": 0.9, "workshop-limb-pose.spec.ts": 3.1, "workshop-manipulation.spec.ts": 1.5,
  "workshop-menu.helpers.spec.ts": 0.6, "workshop-mode-layout.spec.ts": 0.5, "workshop-mouse.spec.ts": 3.4,
  "workshop-picker-dedup.spec.ts": 0.2, "workshop-picker-empty-search.spec.ts": 0.8, "workshop-placement-warning.spec.ts": 0.4,
  "workshop-plate-row.spec.ts": 1.6, "workshop-preview-regression.spec.ts": 0, "workshop-quick-create.spec.ts": 3.4,
  "workshop-recording.spec.ts": 1.1, "workshop-release.spec.ts": 2.6, "workshop-return-navigation.spec.ts": 0.1,
  "workshop-save.spec.ts": 1.4, "workshop-seated-freedom.spec.ts": 6.3, "workshop-selection-focus.spec.ts": 0.6,
  "workshop-shared-dumbbell.spec.ts": 4, "workshop-shortcuts.spec.ts": 0.8, "workshop-studio.spec.ts": 13.5,
  "workshop-supports.spec.ts": 2.2, "workshop-t-bar-row.spec.ts": 0.6, "workshop-timeline-edit.spec.ts": 0.3,
  "workshop-timeline.spec.ts": 1.3, "workshop-tools.spec.ts": 0.5, "workshop-transform-precision.spec.ts": 0.8,
  "workshop-tutorial.spec.ts": 0.8, "workshop-usability.spec.ts": 0.3, "workshop-versatile-equipment.spec.ts": 0.5,
};

// New specs count as a typical workshop spec until they are measured.
const unmeasuredMinutes = 1;

// Gives each spec, heaviest first, to the shard with the least work so far.
export function shardSpecs(specs, total) {
  const minutes = spec => specMinutes[spec] ?? unmeasuredMinutes;
  const shards = Array.from({ length: total }, () => ({ minutes: 0, specs: [] }));
  for (const spec of [...specs].sort((a, b) => minutes(b) - minutes(a) || a.localeCompare(b))) {
    const lightest = shards.reduce((min, shard) => (shard.minutes < min.minutes ? shard : min));
    lightest.minutes += minutes(spec);
    lightest.specs.push(spec);
  }
  return shards.map(shard => shard.specs);
}
