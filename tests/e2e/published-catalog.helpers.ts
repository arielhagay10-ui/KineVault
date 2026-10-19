import { test as base } from "@playwright/test";
import { withPublishedCableRaise, type PublishedExercise } from "../helpers/published-catalog";

export const test = base.extend<object, { publishedCableRaise: PublishedExercise }>({
  publishedCableRaise: [async ({}, useFixture, workerInfo) => {
    await withPublishedCableRaise(workerInfo.project.use.baseURL!, useFixture);
  }, { scope: "worker", timeout: 180_000 }],
});
