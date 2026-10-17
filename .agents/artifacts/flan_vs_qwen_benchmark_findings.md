---
ArtifactMetadata:
  UserFacing: true
  RequestFeedback: true
---

# Benchmark Findings — Flan-T5-base vs Qwen2.5-1.5B-Instruct

> [!NOTE]
> Answering: *"Is it better now after we replaced Flan-T5 with Qwen2.5?"* — **Yes for output correctness and system consolidation; Flan was slightly faster per call.** Measured on this machine, on real rows from the local `uplift` database, using each engine's own production prompts. Date: 2026-10-17.

## 1. Head-to-head (same 2 real jobs, same prompts as production)

| Call | Flan-T5-base (old engine) | Qwen2.5-1.5B-Instruct (new engine) |
| :--- | :--- | :--- |
| Feature extraction — *Maid* (Intensity / Flexibility / Skills) | 5.1 s → `'Yes'` — **format failed**, parses to all-defaults | 4.0 s → `Intensity: Medium, Flexibility: No, Skills: Cleaning, Active standing, Walking, Bending` ✓ |
| Feature extraction — *Computer Encoder* | 1.0 s → `'[type], [moderate], [high]'` — echoes template, parses to all-defaults | 6.4 s → clean one-line format ✓ |
| Posting tags (skills / posture / communication / pace) | 5.4 s → question echo, **zero extractable labels** | 6.5 s → `Skills: Cleaning, Organization, Communication, \| Posture: Mostly Seated \| Communication: Phone/Spoken \| Pace: Standard` ✓ |
| Startup load time | 2.1 s | 1.8 – 4.3 s |
| Disk footprint | 947.5 MB (HF cache folder) | 1,066 MB (Q4_K_M GGUF) |

> [!IMPORTANT]
> Latency caveat: in the side-by-side process the first two Qwen calls took 22–25 s because **both engines were resident in RAM at once** (memory pressure + warm-up). The 4.0 / 6.4 / 6.5 s numbers are from a clean Qwen-only process — the situation that matches production (one model at startup). See [verify_job_extraction.py](file:///C:/Users/reyma/Desktop/UPLIFT-Thesis/tests/verify_job_extraction.py).

## 2. The decisive difference

- Flan failed **all 3** sampled real prompts to follow the requested one-line format (raw outputs above). In the old code those failures silently left job features at defaults (no skills, no intensity).
- Qwen followed the exact label format in **every sampled call** across the A/B run and two independent verify runs, and all parsed values were type-safe.
- With Qwen, the employer posting suggestions are actually derived from the posting text for the first time.
- Sample scope: 2 real job texts × 2 extraction paths. A larger evaluation campaign is possible but was not run.

## 3. Consolidation effects

| Before | After |
| :--- | :--- |
| Flan-T5 (947.5 MB) **and** Qwen GGUF (1,066 MB) both loaded at startup | Only the Qwen GGUF (~1 GB less peak RAM) |
| Two independent generative engines to tune, prompt, and document | One model, one prompt style, one lock |
| Extraction ran inline on the event loop (Flan call in async endpoint) | Extraction runs in a threadpool; all local-LLM calls serialized by one lock (llama-cpp is not thread-safe) |
| Flan failures could kill the clarity score into a static fallback | Deterministic pillar scoring survives model absence by design |

## 4. Documentation update (done with your approval)

- 27 replacements across 5 files — `ARCHITECTURAL_WALKTHROUGH.md`, `full_system_documentation.md`, `system_documentation.md`, `UPLIFT THESIS.md`, `generate_docx.py`.
- Verified: **0** case-insensitive "flan" mentions remain in those files (git diff: 42 insertions / 45 deletions).
- Accuracy fix applied: thesis glossary entry **"Beam Search" → "Greedy Decoding"** (llama.cpp/Qwen decodes greedily at temperature 0 — beam search no longer describes the system).

## 5. Follow-ups requiring your call

1. **Delete the inert Flan weights?** `model_cache/models--google--flan-t5-base` (947.5 MB) is no longer referenced by any runtime code.
2. **Resume-path claims flagged** — the *Standardized Resume Management (RenderCV)* sections (in `full_system_documentation.md` and `system_documentation.md`) state the LLM "refines the extracted entities / enhances bullet-points" during resume generation. Checked `render_engine.py`: **no LLM is used there — with Flan or Qwen.** The model names were updated, but the capability claim itself is not implemented. Options: remove the claim, keep it as future work, or implement it.
3. **`git commit`** of the whole change set — parked until you confirm.
