import sys
import os
import json
import torch

# Adjust path to find server module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import server
from server import tokenizer, gen_model, device

def test_prompt():
    job_title = "Administrative Assistant"
    user_ctx = "Person with Physical: Wheelchair User, Psychosocial: Depression disability. Background: Organization, computer. Experience: N/A. Ontology-Based Compatibility Findings: Relaxed work tempo aligns well with physical stamina requirements."
    
    safety = 10.5
    skills = 19.7
    stamina = 100.0
    ontology = 100.0
    
    score_context = (
        f"Matching metrics: safety alignment = {safety:.1f}%, "
        f"technical skill relevance = {skills:.1f}%, "
        f"sustainability and stamina = {stamina:.1f}%, "
        f"workplace suitability = {ontology:.1f}%."
    )
    
    context = "Physical accessibility planning emphasizes posture management and ergonomic alignment. Controlled seating allows high-fidelity support, with attention given to regular posture variation."
    
    # Let's test standard Flan-T5 formats and repetition penalties
    styles = [
        {
            "name": "Standard T5 format (repetition_penalty=1.0)",
            "rep_penalty": 1.0,
            "prompt": (
                f"Answer the question based on the context.\n\n"
                f"Context: {context} User profile: {user_ctx} Job: {job_title}. Metrics: {score_context}\n\n"
                f"Question: Explain why this job environment is safe for the user.\n\n"
                f"Answer:"
            )
        },
        {
            "name": "Standard T5 format (repetition_penalty=1.2)",
            "rep_penalty": 1.2,
            "prompt": (
                f"Answer the question based on the context.\n\n"
                f"Context: {context} User profile: {user_ctx} Job: {job_title}. Metrics: {score_context}\n\n"
                f"Question: Explain why this job environment is safe for the user.\n\n"
                f"Answer:"
            )
        },
        {
            "name": "Standard T5 format (repetition_penalty=1.5)",
            "rep_penalty": 1.5,
            "prompt": (
                f"Answer the question based on the context.\n\n"
                f"Context: {context} User profile: {user_ctx} Job: {job_title}. Metrics: {score_context}\n\n"
                f"Question: Explain why this job environment is safe for the user.\n\n"
                f"Answer:"
            )
        },
        {
            "name": "Short direct prompt (repetition_penalty=1.0)",
            "rep_penalty": 1.0,
            "prompt": (
                f"Context: {context} User has physical needs. Job is {job_title} with safety score {safety:.1f}%.\n"
                f"Question: Explain why this job matches the user's needs.\n"
                f"Answer:"
            )
        }
    ]
    
    for s in styles:
        print(f"\n--- Testing style: {s['name']} ---")
        inputs = tokenizer(s["prompt"], return_tensors="pt").to(device)
        outputs = gen_model.generate(
            **inputs, 
            max_new_tokens=250, 
            temperature=0.1, 
            do_sample=False,
            repetition_penalty=s["rep_penalty"], 
            no_repeat_ngram_size=3, 
            early_stopping=True
        )
        res = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
        print(f"Result: {res}")

if __name__ == "__main__":
    test_prompt()
