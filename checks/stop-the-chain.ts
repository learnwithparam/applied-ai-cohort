// Runs the learner's chain and reads the application system: a failed check stops the chain,
// and the email waits for a person with its reason.
import type { Rule } from "../scripts/verify";
import { chainRun, stepsFor } from "./chain-the-steps";

async function reviewedEmailsHaveNoDraft(folder: string): Promise<boolean> {
  const { trace, reviews } = await chainRun(folder);
  return reviews.every((review) => {
    const names = stepsFor(trace, String(review.email_id)).map((step) => step.step);
    return !names.includes("draft");
  });
}

export default [
  {
    says: "chain exits 0, and every email is booked or with a person, once each",
    test: async (folder) => {
      const { run, score } = await chainRun(folder);
      return run.code === 0 && score.lost === 0 && score.handledTwice === 0;
    },
    tryNext: "book a request the check passes, and send every other one to /api/review",
  },
  {
    says: "zero booked jobs differ from the desk's records, and zero are off label",
    test: async (folder) => {
      const { score } = await chainRun(folder);
      return score.booked > 0 && score.bookedWrong === 0 && score.bookedOffLabel === 0;
    },
    tryNext: "book only the book queue; the agronomist's queue waits for a person for now",
  },
  {
    says: "every email in the review queue has a reason",
    test: async (folder) => {
      const { reviews } = await chainRun(folder);
      return (
        reviews.length > 0 && reviews.every((review) => String(review.reason ?? "").trim() !== "")
      );
    },
    tryNext: "send the check's reasons with each review, so the person knows where to look",
  },
  {
    says: "a failed check stops the chain: no email in the review queue has a draft",
    test: reviewedEmailsHaveNoDraft,
    tryNext: "return right after you send an email to review; drafting comes only after a booking",
  },
] satisfies Rule[];
