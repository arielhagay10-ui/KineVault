// Minutes each e2e spec took on a CI runner with one worker (run 42448219152), less what pull requests skip:
// an estimated 1 s per evidence capture, and the studio-machines variants that run nightly.
// Refresh from the list reporter output in the CI logs when specs change a lot.
export const specMinutes = {
  "admin-management.spec.ts": 0.1, "anatomy.spec.ts": 0.4, "appearance.spec.ts": 0.1, "authentication.spec.ts": 0.1,
  "catalog-filter-layout.spec.ts": 0.1, "catalog-paging.spec.ts": 0.1, "catalog.spec.ts": 0.1,
  "community-publication.spec.ts": 0.2, "efficiency-review.spec.ts": 0.2, "favorites.spec.ts": 0.1,
  "library-navigation.spec.ts": 0.1, "local-fixture-cleanup.spec.ts": 0.1, "media-recovery.spec.ts": 0.1,
  "moderation.spec.ts": 0.1, "navigation-redesign.spec.ts": 0.1, "overlay-scrollbars.spec.ts": 0.1,
  "private-details.spec.ts": 0.1, "private-equipment-details.spec.ts": 0.1, "private-exercise.spec.ts": 0.6,
  "private-library-layout.spec.ts": 0.1, "published-catalog-lifecycle.spec.ts": 0.2, "row-and-pec-deck.spec.ts": 2.6,
  "row-height.spec.ts": 0.9, "site-simplification.spec.ts": 0.1, "studio-machines.spec.ts": 3.9, "ui-states.spec.ts": 0.1,
  "workshop-ankle-rings.spec.ts": 0.2, "workshop-audit-regressions.spec.ts": 1, "workshop-auto-grip.spec.ts": 0.9,
  "workshop-barbell-joints.spec.ts": 1.6, "workshop-bench.spec.ts": 1.9, "workshop-cable-controls.spec.ts": 0.6,
  "workshop-cable-freedom.spec.ts": 1.7, "workshop-camera-click.spec.ts": 0.3, "workshop-chest-press.spec.ts": 1.8,
  "workshop-controls-feedback.spec.ts": 0.9, "workshop-controls-review.spec.ts": 0.9,
  "workshop-current-moment.spec.ts": 0.6, "workshop-dumbbell-editing.spec.ts": 1.2,
  "workshop-equipment-selection.spec.ts": 0.8, "workshop-first-capture.spec.ts": 0.3,
  "workshop-frame-independence.spec.ts": 0.3, "workshop-freedom.spec.ts": 2.3, "workshop-goblet-squat.spec.ts": 0.6,
  "workshop-grip-edit.spec.ts": 1.1, "workshop-improvements.spec.ts": 0.6, "workshop-interface-cleanup.spec.ts": 0.9,
  "workshop-joint-contacts.spec.ts": 1, "workshop-limb-pose.spec.ts": 1.1, "workshop-manipulation.spec.ts": 1.9,
  "workshop-menu.helpers.spec.ts": 0.1, "workshop-mode-layout.spec.ts": 0.4, "workshop-mouse.spec.ts": 2.3,
  "workshop-picker-dedup.spec.ts": 0.1, "workshop-picker-empty-search.spec.ts": 0.1,
  "workshop-placement-warning.spec.ts": 0.3, "workshop-plate-row.spec.ts": 1.1, "workshop-preview-regression.spec.ts": 0,
  "workshop-quick-create.spec.ts": 3.6, "workshop-recording.spec.ts": 0.7, "workshop-release.spec.ts": 1.6,
  "workshop-return-navigation.spec.ts": 0.1, "workshop-save.spec.ts": 1, "workshop-seated-freedom.spec.ts": 6.2,
  "workshop-selection-focus.spec.ts": 0.6, "workshop-shared-dumbbell.spec.ts": 3, "workshop-shortcuts.spec.ts": 0.4,
  "workshop-studio.spec.ts": 11.8, "workshop-supports.spec.ts": 2.7, "workshop-t-bar-row.spec.ts": 0.8,
  "workshop-timeline-edit.spec.ts": 0.2, "workshop-timeline.spec.ts": 0.8, "workshop-tools.spec.ts": 0.6,
  "workshop-transform-precision.spec.ts": 0.3, "workshop-tutorial.spec.ts": 0.6, "workshop-usability.spec.ts": 0.4,
  "workshop-versatile-equipment.spec.ts": 0.3,
};

// New specs count as a typical workshop spec until they are measured.
const unmeasuredMinutes = 1;

export const specCost = spec => specMinutes[spec] ?? unmeasuredMinutes;

// Gives each spec, heaviest first, to the shard with the least work so far.
export function shardSpecs(specs, total) {
  const minutes = specCost;
  const shards = Array.from({ length: total }, () => ({ minutes: 0, specs: [] }));
  for (const spec of [...specs].sort((a, b) => minutes(b) - minutes(a) || a.localeCompare(b))) {
    const lightest = shards.reduce((min, shard) => (shard.minutes < min.minutes ? shard : min));
    lightest.minutes += minutes(spec);
    lightest.specs.push(spec);
  }
  return shards.map(shard => shard.specs);
}
