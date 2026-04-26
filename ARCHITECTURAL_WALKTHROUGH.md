# UPLIFT-AI: Architectural & System Flow Walkthrough

This document outlines the technical architecture and data flow of the UPLIFT-AI Suitability Engine (Version 6.0). This system is designed specifically to solve the "Semantic vs. Logic" gap in PWD job matching.

---

## 1. High-Level Architecture
The system follows a **Modular Monolith** architecture with a clear separation between the presentation layer (Frontend), the logic engine (Backend), and the AI cluster.

### System Flow Diagram
1.  **Frontend (Client)**: User submits PWD profile data.
2.  **FastAPI (Backend)**: Receives request and triggers the Matching Pipeline.
3.  **Stage 1 (Bi-Encoder Retrieval)**: Fast semantic scan using `all-MiniLM-L12-v2` via FAISS. This filters 100,000+ jobs down to the top 15 in milliseconds.
4.  **Stage 2 (Cross-Encoder Re-ranking)**: High-precision validation using `ms-marco-MiniLM-L-6-v2` on the top 15 candidates.
5.  **Stage 3 (Hybrid Scoring)**: Refinement using **Pre-computed Structured Data** (AI-extracted hours/skills) for O(1) matching speed.
6.  **Stage 4 (LLM Analysis)**: Generative reasoning using `flan-t5-base` for matches ≥ 50%.
7.  **Expert Synthesis**: Integration of built-in vocational knowledge.
8.  **Final Response**: Detailed JSON report returned for UI rendering.

---

## 2. The Detailed Tech Stack & Roles

### Core Infrastructure
*   **FastAPI & Uvicorn**: The **Orchestrator**. It manages the API endpoints, handles asynchronous background tasks (like AI ingestion), and coordinates the flow of data between the user, the database, and the AI models.
*   **SQLite3**: The **Relational Memory**. It stores structured metadata for jobs (titles, descriptions, pre-computed skills, and hours). It provides the "Hard-Logic" data used in Stage 3.
*   **FAISS (Facebook AI Similarity Search)**: The **Geometric Index**. It stores high-dimensional vectors and performs ultra-fast similarity searches. It is the key to handling 100k+ jobs by finding "neighbors" in vector space.

### The AI Cluster (Three-Tier Intelligence)
1.  **Bi-Encoder (`all-MiniLM-L12-v2`)**: The **Librarian**.
    *   *Role*: Mass-retrieval.
    *   *How it fits*: It translates text into 384-dimensional "meaning coordinates." It is used to quickly narrow down 100,000 jobs to the 15 most promising candidates.
2.  **Cross-Encoder (`ms-marco-MiniLM-L-6-v2`)**: The **Judge**.
    *   *Role*: Precision Re-ranking.
    *   *How it fits*: Unlike the Bi-encoder, it looks at the Candidate and the Job *at the same time*. It provides a highly nuanced "Safety Score" by understanding the specific relationship between a disability and a workplace environment.
3.  **Generative Engine (`flan-t5-base`)**: The **Analyst & Secretary**.
    *   *Role*: Feature Extraction (Ingestion) and Narrative Analysis (Matching).
    *   *How it fits*: 
        *   During **Ingestion**, it acts as a secretary to extract skills/hours into the DB.
        *   During **Matching**, it acts as a vocational expert to write the final suitability report based on expert knowledge.

---

## 3. Core System Components

### A. Semantic Retrieval Engine (Retrieval)
Uses the **Bi-Encoder** architecture to convert text into fixed-length vectors (384 dimensions).
*   **Vectorization**: Job requirements are vectorized upon admin approval and stored in FAISS.
*   **Cosine Similarity**: Used to calculate the "Semantic Distance" between candidate capabilities and job environments.

### B. High-Precision Re-ranking (Validation)
To solve the "vague similarity" problem, the system uses a **Cross-Encoder**.
*   **Pairwise Scoring**: Unlike Bi-encoders, the Cross-encoder processes the candidate profile and job requirements *together* as a single input, allowing it to capture complex interactions between PWD limitations and workplace barriers.
*   **Safety Normalization**: Raw logits are converted to a 0-100% "Physical Safety Score" using a sigmoid function.

### C. Hybrid Scoring Logic (Final Scoring)
To ensure accuracy for PWD limitations, the system uses a weighted scoring model that combines AI intuition with hard-logic facts:
*   **Safety Score (40%)**: Driven by the **Cross-Encoder**. It represents the AI's confidence in the environmental fit.
*   **Skill Score (40%)**: Driven by **Pre-computed DB Columns**. It compares the candidate's skills against the AI-extracted requirements from the database.
*   **Sustainability Score (20%)**: Driven by **Psychosocial Fit Logic**. It evaluates the "Burnout Risk" by comparing task intensity against user preferences and the available schedule flexibility.

### D. Knowledge-Augmented Generation (Analysis)
Uses **Flan-T5-Base** combined with a local **Expert Knowledge Matrix**.
*   **Strategic Advantage**: By injecting "Expert Knowledge" (Vocational standards for Orthopedic, Visual, etc.) into the AI prompt, the system ensures the report is grounded in professional standards and doesn't just "parrot" the user's input.
*   **Reasoning Penalty**: The model uses a repetition penalty and beam search to ensure high-quality, non-templated prose.

---

## 4. Performance & Scalability Features
*   **Ingestion-Time Extraction**: Heavily structured features (skills, intensity level, flexibility) are extracted using **Flan-T5** *during job approval*. This moves the "thinking" time to the background, making the user-facing match request near-instant.
*   **Constant-Time Re-ranking**: By limiting the Cross-Encoder and LLM analysis to only the top-N candidates retrieved by FAISS, the system's response time remains constant whether you have 100 jobs or 100,000 jobs.
*   **Local Caching**: All model weights and embeddings are stored locally in `./model_cache`, enabling fast startup and consistent performance without constant internet dependency.

---

## 5. Summary of Innovation
The UPLIFT-AI architecture moves beyond "Keyword Search" or "Generic AI Chat." It creates a **Verified Suitability Report** by combining:
1.  **Semantic Retrieval** (Fast search)
2.  **Hard-Logic Validation** (Accurate limitations check)
3.  **Generative Reasoning** (Human-readable professional analysis)
