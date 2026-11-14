# Watch and read candidates

This file helps the page pass. It lists 8 to 10 candidates for each part. The page pass cuts each list to 4 to 6, keeps at least 2 videos, and deletes this file.

For example, a good pick comes from the person who made the method. It is about the idea, not a launch. It is never a listicle or a paywall page.

The bar comes from section 5 of STANDARD-v2. I did not check live links or exact titles here. The page pass must find and check each one, and must drop any pick it cannot find. A year marks when I believe it first came out.

Each line has the author, the year, the kind, the title and why it passes.

## Orientation: meet the world and run the finished system

- **Anthropic (Erik Schluntz and Barry Zhang)**, 2024, read: Building effective agents. Written by the team that builds and runs the agents. It is about the idea, not a launch.
- **Barry Zhang, Anthropic, AI Engineer conference**, 2025, video: How we build effective agents. A conference talk from the same author. It shows the shape of the system we run first.
- **Andrej Karpathy**, 2023, video: Intro to large language models. A long, calm talk by a person who built and taught these models. It is evergreen.
- **Chip Huyen**, 2023, read: Building LLM applications for production. From a practitioner who runs this work. It lists the problems the course fixes in order.
- **Eugene Yan**, 2023, read: Patterns for building LLM-based systems and products. Written by a person who ships these systems. It names seven patterns.
- **Hamel Husain**, 2025, read: A field guide to rapidly improving AI products. Drawn from many real products. It puts measuring first, like the course.
- **OpenAI**, 2025, read: A practical guide to building agents. A guide from a company that runs agents in production. A second view for comparison.
- **Simon Willison**, 2025, read: Blog series on how he uses LLMs. From a long-time open-source maker. It shows the daily habits, with no hype.

## Part 1: get records you can trust

- **Anthropic**, 2025, read: Structured outputs, in the API docs. Official docs from the maker. It explains how to get a reply in a fixed shape.
- **Pydantic team**, 2024, read: Pydantic docs: validators. The official docs of the tool most teams use to check a reply's shape.
- **Hamel Husain**, 2024, read: Your AI product needs evals. A practitioner's case for checking records against truth, with real examples.
- **Eugene Yan**, 2024, read: Task-specific LLM evals that do and do not work. Written from production use. It shows which simple checks catch real errors.
- **Chip Huyen**, 2024, read: Building a generative AI platform. Covers cost and latency from a person who runs such platforms.
- **Anthropic**, 2025, read: Pricing and token counting, in the API docs. Official docs. They show where cost per call comes from.
- **Andrej Karpathy**, 2024, video: Let's build the GPT tokenizer. Shows why tokens drive cost. By a person who built the models.
- **Martin Kleppmann**, 2017, read: Designing Data-Intensive Applications, chapter on data models. A trusted book on why records need a schema. The idea does not age.

## Part 2: measure before you change

- **Hamel Husain**, 2024, read: Your AI product needs evals. From an engineer who has set up evals for many teams. About the idea, not a product.
- **Hamel Husain and Shreya Shankar**, 2025, video: AI evals for engineers, talks and office hours. The method's authors teach it. Covers traces, failure names and golden sets.
- **Anthropic**, 2025, read: Demystifying evals for AI agents. From the team that runs agent evals in production. The course already cites it.
- **Shreya Shankar and others**, 2024, read: Who validates the validators? Aligning LLM-assisted evaluation. The original paper on aligning a judge to human labels.
- **Lianmin Zheng and others**, 2023, read: Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. The paper that set out when a judge agrees with people, and when it does not.
- **Eugene Yan**, 2024, read: Evaluating the effectiveness of LLM evaluators. A review of judge research by a practitioner, in plain words.
- **Hamel Husain**, 2024, read: Creating a LLM-as-a-judge that drives business results. Shows one judge built step by step on real data.
- **Jason Liu**, 2024, video: Systematically improving RAG applications. A talk about reading failures before changing anything.
- **Langfuse team**, 2025, read: Docs: datasets and evaluation. Official docs from a tool teams run for this job.

## Part 3: answer from the sources

- **Anthropic**, 2024, read: Introducing contextual retrieval. From the maker. It measures how chunk context cuts retrieval misses. The course cites it.
- **Patrick Lewis and others**, 2020, read: Retrieval-augmented generation for knowledge-intensive NLP tasks. The original RAG paper.
- **Stephen Robertson and Hugo Zaragoza**, 2009, read: The probabilistic relevance framework: BM25 and beyond. The source of BM25, the baseline the course asks you to beat.
- **Rodrigo Nogueira and Kyunghyun Cho**, 2019, read: Passage re-ranking with BERT. The paper that began reranking with a second model.
- **Cohere**, 2024, read: Docs: rerank overview. Official docs from a company that sells reranking. It shows the two-stage pattern.
- **Jason Liu**, 2024, video: Systematically improving RAG applications. Talk on synthetic questions and recall, by a consultant who ships RAG.
- **Eugene Yan**, 2024, read: Patterns for building LLM-based systems: retrieval. Plain account of retrieval, caching and guardrails.
- **Omar Khattab and Matei Zaharia**, 2020, read: ColBERT: efficient and effective passage search. A paper by the method's authors. It explains why a second read is sharper.

## Part 4: decide and wait

- **Anthropic (Erik Schluntz and Barry Zhang)**, 2024, read: Building effective agents: routing and prompt chaining. The authors name the routing and chaining patterns this part builds.
- **Temporal team**, 2024, read: Docs: what is durable execution. Official docs from a company that runs long waits in production.
- **Maxim Fateev, Temporal**, 2023, video: Durable execution, conference talk. The maker explains why a crash must not lose or repeat work.
- **Brandur Leach, Stripe**, 2017, read: Designing strong and predictable APIs with idempotency. The source of the idempotency key idea. It stops a job being booked twice.
- **Hamel Husain**, 2025, read: A field guide to rapidly improving AI products: human review. Shows how real teams route unsure items to a person.
- **Harrison Chase, LangChain**, 2025, video: Human in the loop with agents. A talk from the team that runs the tool. It shows waiting for approval.
- **Martin Fowler**, 2014, read: Circuit breaker. A trusted pattern for stopping a chain. It is old and still true.
- **Pat Helland**, 2007, read: Life beyond distributed transactions. A classic paper on doing work once without a global lock.

## Part 5: let it act

- **Anthropic**, 2025, read: Writing effective tools for agents. From the team that builds and runs tool use. It covers names and errors.
- **Model Context Protocol team**, 2025, read: MCP docs: tools and the spec. The official spec for the protocol the part uses.
- **Shunyu Yao and others**, 2022, read: ReAct: synergizing reasoning and acting in language models. The paper behind the loop the part asks you to write.
- **Anthropic**, 2025, read: Effective context engineering for AI agents. Explains trimming, caching and what to keep. Added for the new context step.
- **Anthropic**, 2025, read: Prompt caching, in the API docs. Official docs on how a steady prompt start cuts cost.
- **Lance Martin, LangChain**, 2025, video: Context engineering for agents. A talk about trimming and offloading context in a real agent.
- **Barry Zhang, Anthropic**, 2025, video: How we build effective agents. The talk on loops, tools and stop conditions.
- **Anthropic**, 2025, read: Demystifying evals for AI agents: grading the end state. Grading what the agent did, not what it said. The course already cites it.
- **OpenAI**, 2025, read: A practical guide to building agents: guardrails and limits. A second company's view of step and cost limits.

## Part 6: make it safe and visible

- **OWASP**, 2025, read: Top 10 for LLM applications. A standards group's list. It names prompt injection and data leaks.
- **Simon Willison**, 2025, read: The lethal trifecta for AI agents. From a respected practitioner. A short rule for when an agent is unsafe.
- **Simon Willison**, 2023, read: Prompt injection explained, with examples. He named the problem and has tracked it since.
- **Johann Rehberger**, 2024, video: Prompt injection and agent exploits, conference talk. A security researcher who found real attacks in shipped products.
- **OpenTelemetry project**, 2025, read: Semantic conventions for generative AI. The open standard for trace fields, from the project that sets them.
- **Langfuse team**, 2025, read: Docs: tracing and cost tracking. Official docs of a trace tool that teams run themselves.
- **Microsoft**, 2024, read: Presidio docs: finding and hiding private data. Official docs of a widely used open-source tool for this job.
- **Anthropic**, 2025, read: Mitigate jailbreaks and prompt injections, in the docs. The maker's own advice on guarding input.
- **Chip Huyen**, 2024, read: Building a generative AI platform: guardrails. A practitioner's account of input and output guards.

## Part 7: ship it

- **Marc Brooker, Amazon Builders' Library**, 2019, read: Timeouts, retries and backoff with jitter. From the team that runs the service. It is the base of the outage step.
- **Betsy Beyer and others, Google**, 2016, read: Site Reliability Engineering: addressing cascading failures. From Google's operators. It shows why blind retries make outages worse.
- **Martin Fowler**, 2014, read: Circuit breaker. A short, trusted pattern for stopping calls to a failing service.
- **Anthropic**, 2025, read: API errors and rate limits, in the docs. Official docs listing which statuses to retry and which not.
- **Hamel Husain**, 2025, read: A field guide to rapidly improving AI products. Real teams turning live feedback into new test cases.
- **Eugene Yan**, 2024, read: Product evals in three simple steps. Written from production use. It shows how to grow a test set from real use.
- **Chip Huyen**, 2025, read: AI Engineering, the chapters on feedback and monitoring. A book by a practitioner. It covers feedback loops.
- **Anthropic**, 2025, read: Demystifying evals for AI agents: regression evals. The course cites it for the release gate.
- **Charity Majors**, 2023, video: Observability and testing in production, conference talk. From a founder of an observability company. It covers shipping safely.
- **GitHub**, 2025, read: Docs: workflow syntax for GitHub Actions. Official docs for the gate the part writes.

## Part 8: add one capability

- **Anthropic**, 2024, read: Introducing contextual retrieval: prompt caching. From the maker. It shows a cost number measured on real runs.
- **Anthropic**, 2025, read: Batch processing, in the API docs. Official docs on running work overnight at lower cost.
- **Chip Huyen**, 2023, read: Multimodality and large multimodal models. A clear account of photos and voice, by a practitioner.
- **Pipecat team (Daily)**, 2025, read: Pipecat docs: voice agents. Official docs from the team that makes and runs the tool.
- **Anthropic**, 2025, read: How we built our multi-agent research system. Written by the team that runs it. It has real cost numbers.
- **Andrej Karpathy**, 2025, video: Deep dive into LLMs like ChatGPT. A long talk that shows what fine-tuning changes.
- **Anthropic (Erik Schluntz and Barry Zhang)**, 2024, read: Building effective agents. The team that runs agents lists when each pattern earns its cost.
- **Chip Huyen**, 2025, read: AI Engineering, the chapter on model routing and cost. A practitioner's book on one number at a time.
- **Eugene Yan**, 2023, read: Patterns for building LLM-based systems and products. Written from production use, with guardrails and caching.
- **Hamel Husain**, 2024, read: Your AI product needs evals. Says to measure before each change, which is this part's rule.

## Part 9: do it with the tools teams run

- **Langfuse team**, 2025, read: Docs: get started with tracing. Official docs from the people who make and host it.
- **Langfuse team**, 2025, video: Langfuse walkthrough on YouTube. A demo by the makers, showing a real trace.
- **OpenTelemetry project**, 2025, read: Docs: concepts, traces and spans. The open standard behind most trace stores.
- **OpenTelemetry project**, 2025, read: Semantic conventions for generative AI. Sets the field names that tools share.
- **Ben Sigelman, Lightstep**, 2019, video: Distributed tracing talk, conference. A founder of the field explains what a trace is.
- **Hamel Husain**, 2024, read: Your AI product needs evals: look at your data. Why read traces before building tools.
- **Anthropic**, 2025, read: Demystifying evals for AI agents: reading transcripts. Official guidance on reading transcripts.
- **Chip Huyen**, 2024, read: Building a generative AI platform: observability. A practitioner on why teams keep a trace store.

## Part 10: check access with OpenFGA

- **OpenFGA project (CNCF)**, 2025, read: Docs: getting started and modeling. Official docs from the project and its foundation.
- **Ruoming Pang and others, Google**, 2019, read: Zanzibar: Google's consistent, global authorization system. The paper OpenFGA follows. It is the original source.
- **Auth0 and Okta (OpenFGA team)**, 2023, video: Modeling fine-grained access with OpenFGA, talk. A talk by the team that builds the tool.
- **OWASP**, 2025, read: Authorization cheat sheet. A standards group's plain rules for access checks.
- **OWASP**, 2025, read: Top 10 for LLM applications: excessive agency. Names the risk of an agent acting beyond its rights.
- **Simon Willison**, 2025, read: The lethal trifecta for AI agents. A short rule that links access to agent risk.
- **Ravi Sandhu and others**, 1996, read: Role-based access control models. The paper that set out the roles idea that OpenFGA extends.
- **Open Policy Agent project (CNCF)**, 2025, read: Docs, policy language overview. A second open tool for the same job, so learners can compare.
- **Google Cloud**, 2019, video: Zanzibar talk at the USENIX conference. The authors present the system that OpenFGA follows.

## Part 11: run the agent with Google ADK

- **Google**, 2025, read: Agent Development Kit docs. Official docs of the framework from its maker.
- **Google Cloud**, 2025, video: Agent Development Kit introduction, on YouTube. A talk by the team that builds it.
- **Shunyu Yao and others**, 2022, read: ReAct: synergizing reasoning and acting in language models. The idea under every agent loop, to compare with your own.
- **Anthropic**, 2024, read: Building effective agents: frameworks. Honest advice on when a framework helps and when it hides the loop.
- **OpenAI**, 2025, read: A practical guide to building agents. A second maker's view, to compare.
- **Harrison Chase, LangChain**, 2025, read: How to think about agent frameworks. A framework maker explains the trade.
- **Model Context Protocol team**, 2025, read: MCP docs: client and server. Official docs for the tool side that ADK also speaks.
- **Simon Willison**, 2025, read: Agents are models using tools in a loop. A short, clear definition from a respected practitioner.
- **Anthropic**, 2025, read: Claude Agent SDK docs. Official docs of a second agent framework, to compare with ADK.
