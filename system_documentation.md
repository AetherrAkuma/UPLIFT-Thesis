# UPLIFT: System Documentation (v7.2)

## 1. Purpose and Context
**UPLIFT** is a two-sided vocational marketplace designed to bridge the employment gap for **Persons with Disabilities (PWDs)**. The system moves beyond traditional keyword-based job matching by utilizing high-fidelity AI models to evaluate the "suitability" of a role based on environmental, physical, and cognitive demands against a user's specific accessibility needs.

### Core Objectives:
*   **Empower PWDs**: Provide transparent, AI-driven career guidance and job matching.
*   **Support Inclusive Employers**: Offer tools to model jobs accurately and reach a diverse, verified talent pool.
*   **Ensure Safety & Trust**: Implement a rigorous verification engine for organizations and high-fidelity auditing for job postings.

---

## 2. Technical Stack
The system is built on a modern, high-performance stack optimized for AI inference and rapid retrieval.

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React (Vite) | Single Page Application (SPA) with a focus on accessibility (WCAG compliance). |
| **Styling** | Vanilla CSS / CSS Modules | Custom design system for premium look and feel. |
| **Backend** | FastAPI (Python) | High-performance asynchronous API orchestration. |
| **Database** | SQLite3 | Relational data storage for profiles, jobs, and audit logs. |
| **Vector Engine** | FAISS | Geometric indexing for constant-time semantic job retrieval. |
| **AI Models** | Sentence-Transformers | Bi-Encoders (`all-MiniLM-L12-v2`) and Cross-Encoders (`ms-marco-MiniLM-L-6-v2`). |
| **LLM Engine** | Flan-T5-Base | Generative reasoning for suitability analysis and feature extraction. |
| **OCR Engine** | PaddleOCR-VL | Layout-aware vision-language OCR for ID verification. |
| **Parsing Engine** | pydparser | Structured data extraction from uploaded resumes. |
| **Doc Generation** | RenderCV | LaTeX-powered professional PDF resume generation. |
| **Auth** | JWT (JSON Web Tokens) | Secure stateless authentication with Role-Based Access Control (RBAC). |

---

## 3. System Architecture
UPLIFT follows a **Modular Monolith** architecture with specialized pipelines for AI processing.

### High-Level Components:
1.  **Orchestrator (FastAPI)**: Manages all business logic, RBAC, and communication between the DB and AI layers.
2.  **Matching Pipeline**:
    *   **Stage 1: Retrieval**: Semantic scan via FAISS.
    *   **Stage 2: Re-ranking**: Cross-encoder validation for environmental fit.
    *   **Stage 3: Hybrid Scoring**: Weighted integration of skills, safety, and stamina.
    *   **Stage 4: LLM Synthesis**: Generative "Suitability Report" explaining the match.
3.  **Verification Engine**: A multi-step workflow for auditing employers and jobs.
4.  **Ingestion Pipeline**: Background tasks that extract structured data (skills, intensity) from raw text using NLP.
5.  **Verification & Branding Suite**: 
    *   **ID Auditor**: PaddleOCR-VL driven verification for PWD credentials.
    *   **Vocational Branding**: pydparser and RenderCV for standardized resume generation.


---

## 4. Database Schema
The system uses a relational schema stored in `uplift_prototype.db`.

### Core Tables:
*   **`users`**: Stores PWD profiles, Employer metadata, and Admin accounts.
    *   *Key Columns*: `id`, `email`, `role`, `status`, `summary`, `skills`, `disabilities` (JSON), `skill_weight`, `safety_weight`, `stamina_weight`, `verification_data` (JSON).
*   **`jobs`**: High-fidelity job listings.
    *   *Key Columns*: `id`, `employer_name`, `job_title`, `job_description`, `physical_requirements`, `embedding` (Vector), `work_environment`, `work_tempo`, `accessibility_features`, `status` (pending/approved).
*   **`applications`**: Tracks the link between candidates and jobs.
    *   *Key Columns*: `id`, `user_id`, `job_id`, `status` (Pending/Shortlisted/Rejected), `applied_at`, `resume_data`.
*   **`audit_logs`**: System-wide activity tracking for administrative oversight.
    *   *Key Columns*: `id`, `admin_id`, `action`, `target_type`, `target_id`, `timestamp`.

---

## 5. Backend & AI Implementation
The backend is the "Brain" of UPLIFT, responsible for both API management and heavy AI lifting.

### AI Engine Cluster:
### NLP Conceptual Diagram

```mermaid
graph TD
    %% Inputs
    User["PWD Profile"] --> Matcher["Suitability Matcher"]
    Job["Job Description"] --> Matcher

    %% Internal Pipeline
    subgraph "AI Suite (NLP Cluster)"
        direction TB
        M1["Bi-Encoder: all-MiniLM-L12-v2"]
        M2["Cross-Encoder: ms-marco-MiniLM"]
        M3["Gen-AI: Flan-T5-Base"]
    end

    Matcher --> M1
    M1 -- "Semantic Retrieval (FAISS)" --> TopK["Top 50 Matches"]
    
    TopK --> M2
    M2 -- "Barrier Re-ranking" --> Score["High-Fidelity Safety Score"]

    Score --> M3
    M3 -- "Generative Reasoning" --> Report["Final Suitability Report"]

    %% New Components
    subgraph "Verification & Branding Suite"
        direction LR
        OCR["PaddleOCR-VL (ID Verification)"]
        Parser["pydparser (Resume Parsing)"]
        Render["RenderCV (LaTeX Engine)"]
    end
end
```

### AI Engine Cluster Detail:
*   **Bi-Encoder (`all-MiniLM-L12-v2`)**: Converts complex text into 384-dimensional vectors. This allows for "Semantic Search," finding jobs based on intent and meaning rather than just keywords.
*   **Cross-Encoder (`ms-marco-MiniLM-L-6-v2`)**: Performs a side-by-side comparison of the User Profile and Job. It is the core of the "Safety Check," identifying subtle environmental barriers (e.g., a "desk job" that actually requires frequent stair climbing).
*   **Flan-T5-Base**: 
    *   **Extraction**: Automatically extracts Task Intensity and Skills from raw job posts.
    *   **Reasoning**: Generates the "Suitability Report" explaining the match in plain English.

### Security Implementation:
*   **RBAC**: Roles defined as `user` (PWD), `employer`, and `admin`.
*   **Password Hashing**: PBKDF2 with SHA256 and static salt.
*   **Auditability**: Every administrative action (approval/rejection) is logged with a reason and timestamp.

---

## 6. Frontend & Design System
The frontend is a React-based application designed with **Accessibility-First** principles.

### Key Pages:
*   **Landing Page**: High-impact introduction with PWD-centric value propositions.
*   **Dashboard**: Personalized job recommendations with "Match Score" visualization.
*   **Employer Portal**: 3-step onboarding flow (Legal verification -> Profile -> Dashboard).
*   **Admin Portal**: Centralized hub for managing users, approving jobs, and viewing audit logs.
*   **Profile**: Detailed CV builder with AI weight adjustment sliders (Skills vs. Safety).

### Accessibility Features:
*   **Accessibility Fab**: Floating action button allowing users to adjust UI scaling, contrast, and font types.
*   **Semantic HTML**: Proper ARIA labeling for screen reader compatibility.

---

## 7. How It Works: Core Workflows

### A. Employer Onboarding
1.  **Registration**: Employer creates an account (status: `pending`).
2.  **Verification**: Employer submits business permits (SEC/DTI).
3.  **Admin Audit**: System admin reviews documents and activates the account.
4.  **Job Posting**: Employer posts a job; it enters `pending` status for high-fidelity extraction.

### B. Job Ingestion & Extraction (Technical Deep-Dive)
When an employer posts a job, it undergoes a **Multi-Model Ingestion Pipeline**:

1.  **Stage 1: Contextual Vectorization**:
    *   **Model**: `all-MiniLM-L12-v2` (Bi-Encoder Transformer).
    *   **Process**: The system merges Job Title, Description, and Physical Requirements into a single context. This context is projected into a **384-dimensional hyperspace**.
    *   **Goal**: Create a mathematical "fingerprint" of the job for fast similarity matching.

2.  **Stage 2: Generative Feature Extraction**:
    *   **Model Architecture**: `Flan-T5-Base` (Google) - A Sequence-to-Sequence (Seq2Seq) Transformer.
    *   **The Ingestion Prompt**: 
        ```text
        Context: {job_description} {physical_requirements}
        Question: What is the task intensity (Low, Medium, High)? 
                  Does it offer schedule flexibility (Yes, No)? 
                  List the professional skills.
        Answer format: Intensity: [type], Flexibility: [Yes/No], Skills: [list]
        ```
    *   **Parsing Logic (Regex)**: The natural language output is stripped and parsed using:
        *   `r'Intensity:\s*(\w+)'` -> Extracts Intensity level.
        *   `r'Flexibility:\s*(\w+)'` -> Maps "Yes" to `1` and "No" to `0`.
        *   `r'Skills:\s*(.*)'` -> Captures the raw skill string.

3.  **Stage 3: High-Dimensional Vectorization**:
    *   **Model**: `all-MiniLM-L12-v2`.
    *   **Output**: **384-Dimensional Dense Vector**.
    *   **Storage**: **FAISS Index** using L2 Euclidean Distance for similarity ranking.

### C. PWD Matching (The "Suitability Engine")
1.  **Retrieval**: FAISS performs a cosine-similarity scan to find the top 50 matches.
2.  **Re-ranking**: The **Cross-Encoder (`ms-marco-MiniLM`)** scores these 50 matches. Unlike a Bi-Encoder, the Cross-Encoder processes the User Profile and Job *together*, allowing it to detect non-obvious suitability conflicts.
3.  **Hybrid Scoring**: The final "Match %" is a weighted average of:
    *   **Semantic Score** (Overall fit).
    *   **Safety Fit** (Disability-specific alignment).
    *   **Skill Match** (Experience vs. Requirements).
4.  **Generative Analysis**: Flan-T5 synthesizes these data points into a plain-English report explaining *why* the job fits the candidate's unique profile.

---

## 9. Advanced Document & Profile Management

### A. OCR ID Verification (PaddleOCR-VL)
To automate the verification of PWD IDs, the system integrates **PaddleOCR-VL**.
*   **Layout-Aware Extraction**: Understands spatial relationships between fields on an ID card.
*   **Fraud Detection**: Cross-references extracted data with user profiles to ensure integrity.
*   **Memory Management**: Uses lazy loading and INT8 quantization to maintain low latency during heavy matching tasks.

### B. Standardized Resume Engine (pydparser & RenderCV)
Ensures PWD candidates are presented with professional-grade vocational branding.
1.  **Extraction**: **pydparser** extracts structured data from existing resumes.
2.  **Refinement**: **Flan-T5** optimizes descriptions and suggests workplace accommodations.
3.  **Generation**: **RenderCV** typesets the final resume in **LaTeX**, providing a premium, standardized PDF output.

---

## 10. Summary of Innovation
UPLIFT transforms recruitment from a search-and-apply process into a **Suitability-Validated** journey. By integrating expert vocational knowledge with state-of-the-art NLP, it ensures that PWDs find roles where they can not only work but thrive safely.
