# Sources

Every public number in a learner file, where it came from, and every number from the research brief that was
dropped. A number reaches a learner file only after its page was opened and read when the course was built.

## Numbers in this course

All read on the publisher's own page. Case studies on anthropic.com are a vendor's claims about its customers
and are labelled that way where they appear.

| Where | Number | Quote from the page | Page |
|---|---|---|---|
| Part 1 | EvenUp: accuracy up 14% | "Increased accuracy on past medical expense totals by 14% on smaller cases" | https://www.anthropic.com/customers/evenup |
| Part 2 | 75% per trial, 42% for three passes | "If your agent has a 75% per-trial success rate and you run 3 trials, the probability of passing all three is (0.75)³ ≈ 42%" | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |
| Part 3 | Retrieval failures down 49%, 67% with reranking | "reduced the top-20-chunk retrieval failure rate by 49% (5.7% → 2.9%)" | https://www.anthropic.com/engineering/contextual-retrieval |
| Part 4 | DXC: documents classified in under a second | "documents classified in under a second" | https://www.anthropic.com/customers/dxc |
| Part 5 | Tool descriptions: 40% faster tasks | "resulted in a 40% decrease in task completion time for future agents using the new description" | https://www.anthropic.com/engineering/multi-agent-research-system |
| Part 6 | Tokens explain 80% of variance | "token usage by itself explains 80% of the variance" | https://www.anthropic.com/engineering/multi-agent-research-system |
| Part 7 | Regression evals near 100% | "should have a nearly 100% pass rate" | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |
| Part 8 | Prompt caching up to 90% cheaper | "reducing latency by > 2x and costs by up to 90%" | https://www.anthropic.com/engineering/contextual-retrieval |
| Replay prices | USD 0.07 in, 0.20 out per million tokens | The OpenRouter fast model's list price | `briefs/MODELS.md` in the curriculum repo |
| `pyproject.toml` | LiteLLM 1.109.1 has no known advisory | PyPI lists no vulnerabilities for this release | https://pypi.org/pypi/litellm/1.109.1/json |

## Dropped from the research brief

The brief marked these numbers "(search)": read from a search result summary, never from the page. None of
the pages below could be opened from the build environment, so each one is dropped, not softened. A later
build with these hosts allowed can open each page, confirm the number, and add it above.

| Brief claim | Page that could not be opened |
|---|---|
| C.H. Robinson: email transaction, order and quote volumes and times; typing time per load by hand | chrobinson.com press release |
| UK i.AI Consult: 50,000+ replies themed for £240; expert checking time; F1 0.79 and 0.82 against human coding | gov.uk news page and evaluation report |
| Kingston council: note time down 50 to 60%; Swindon council: 63% less time | local.gov.uk, swindon.gov.uk |
| The Permanente Medical Group: physician, visit and note-time counts | permanente.org |
| Hawaii Pacific Health: note time down 21%, no change in burnout | medinform.jmir.org |
| Bayer E.L.Y.: time saved, 20,000+ questions, replies 60% faster | bayer.com |
| Digital Green Farmer.Chat: 15,000+ farmers, 300,000+ queries, over 75% answered | arxiv.org |
| Instacart Maple: up to 50% lower LLM cost | company.instacart.com |
| Checkr: 90% accuracy on the hardest 2%, 30 times faster, 5 times cheaper | predibase.com |
| Oak National Academy Aila: time saved in a trial in 86 schools; the earlier self-reported figure | educationendowmentfoundation.org.uk |
| Wendy's FreshAI: 22 seconds faster, 86% and 99% accurate | franchisegator.com (a press site, not Wendy's own page) |
| Lemonade: loss adjustment expense ratio 7%, claim volume up more than 2.5 times | lemonade.com shareholder letter |
| Tokio Marine and MS&AD with Tractable: adjuster time forecast | tractable.ai |
| Reuters: video minutes transcribed in 70 languages; 100+ translators | thomsonreuters.com |
| Haskell with Procore: submittal review cut to about 10 minutes | procore.com |
| NextEra Energy: more than $20 million saved; 85% to 90% of technicians use voice tools | powermag.com (a trade press site) |
| Maven course prices, ratings and learner counts (Husain and Shankar, Liu, AI Makerspace, SwirlAI, Bowne-Anderson) | maven.com |
| GitHub Octoverse 2025 language shares | github.blog |
| LangChain survey: quality as the top blocker; agents in production | langchain.com |
| Stack Overflow 2025 survey: distrust of AI accuracy, concern about agents | stackoverflow.blog |
