# Add one capability

## The problem

Every business needs one thing that the core course does not cover. At the spray desk, it could be one of
these:

- photos of damaged crops
- a phone line for growers
- a whole season's requests, run overnight
- cheaper models for easy requests

Pick the one your project needs. Then prove that it moved a number, without breaking the scorecard.

For example, you could try a cheaper model for easy requests. Today `uv run finished` reports
`Model calls: 40, cost $0.000616` on the dev inbox. A good result lowers that cost and still shows
`Booked wrong: 0`.

## Why it matters

Cost is often the capability that matters most. Prompt caching means the provider saves the parts of a
prompt that repeat between calls. Anthropic reports that it cuts "latency by > 2x and costs by up to 90%" for
those prompts ([Anthropic, Introducing Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)).
Latency is how long you wait for an answer. Like every number in this course, it counts only once you measure
it on your own runs.

## What you build

```mermaid
flowchart LR
  A["Pick one: photos, voice, batch, cheaper models, memory, subagents, a tuned model"] --> B["The lab for it"]
  B --> C["Build it on your project"]
  C --> D["Measure: one number before and after"]
  D --> E["Scorecard still green"]
```

## The labs

- Optional, pick any:
  - [Process a Million Prompts with Batch APIs](https://github.com/learnwithparam/live-labs/tree/main/labs/03-batch-prompts)
  - [Build a Voice AI Agent with Pipecat](https://github.com/learnwithparam/live-labs/tree/main/labs/16-voice-pipecat)
  - [Build a Phone AI Agent with LiveKit](https://github.com/learnwithparam/live-labs/tree/main/labs/17-voice-phone)
  - [Read Images with Vision LLMs](https://github.com/learnwithparam/live-labs/tree/main/labs/18-vision-damage)
  - [Add Long-Term Memory to AI Agents with Mem0](https://github.com/learnwithparam/live-labs/tree/main/labs/14-agent-memory)
  - [Build a Deep Research Agent with Subagents](https://github.com/learnwithparam/live-labs/tree/main/labs/15-research-subagents)
  - [Route LLM Calls with an LLM Gateway](https://github.com/learnwithparam/live-labs/tree/main/labs/26-llm-gateway)
  - [Fine-Tune a Small LLM with Reviewed Data](https://github.com/learnwithparam/live-labs/tree/main/labs/34-fine-tune)

## Steps

| Step                   | Minutes | You produce                                                 | Done when (what the check reads)                                           |
| ---------------------- | ------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pick-an-elective`     | 10      | `elective.md`: the capability and the number it should move | Names one elective, its lab, a metric with a direction and a target        |
| `build-the-elective`   | 30      | The capability, behind a contract verb                      | The verb runs on the dev split with no crash                               |
| `measure-the-elective` | 30      | Before and after numbers                                    | The named metric moved in its direction; scorecard lines 1 to 7 still pass |
| `report-the-trade`     | 20      | A three-number write-up                                     | States quality, cost per outcome and the trade, matching the measured run  |

The steps take 90 minutes in total. The lab for your elective adds about 30 minutes. Labs 16, 25 and 34 need
an Apple silicon computer today. They may be rebuilt later to run online.

## Walkthrough

TODO(part session): the commands for each step, each with an `Expect:` line. The steps above are planned.
They have no folders yet, so this part has nothing to check:

```bash
bun run verify part add-one-capability
```

Expect: `Part add-one-capability is done: 0/0 steps pass.`
