"""
Evaluation runner for the Cambodian Labour Law RAG Chatbot.

Usage (from backend/ folder with venv active):
    python ../evaluation/run_eval.py

Output:
    evaluation/results.json       — full results with answers and scores
    evaluation/summary.txt        — human-readable summary table
"""

import json, sys, time, re
from pathlib import Path

# ── Add backend to path so we can import the agent ───────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from agents.orchestrator import agent_graph
from agents.retrieval_agent import retrieve_node, _load_indexes


def run_single_query(question: str) -> dict:
    """Run the full agent pipeline and return state."""
    state = {
        "user_query":           question,
        "session_id":           "eval",
        "conversation_history": [],
        "intent":               "",
        "article_number":       None,
        "rewritten_query":      "",
        "retrieved_chunks":     [],
        "is_grounded":          False,
        "retry_count":          0,
        "final_answer":         "",
        "citations":            [],
        "used_web_search":      False,
    }
    return agent_graph.invoke(state)


def check_citation_hit(result_citations: list, expected_articles: list) -> bool:
    """Check if at least one expected article appears in citations."""
    cited_nums = {str(c.get("article_number", "")) for c in result_citations}
    return any(str(a) in cited_nums for a in expected_articles)


def check_retrieval_hit(retrieved_chunks: list, expected_articles: list) -> bool:
    """Check if any expected article was retrieved (before citation filtering)."""
    retrieved_nums = {str(c.get("article_number", "")) for c in retrieved_chunks}
    return any(str(a) in retrieved_nums for a in expected_articles)


def main():
    dataset_path = Path(__file__).parent / "eval_dataset.json"
    results_path = Path(__file__).parent / "results.json"
    summary_path = Path(__file__).parent / "summary.txt"

    with open(dataset_path, encoding="utf-8") as f:
        dataset = json.load(f)

    questions = dataset["questions"]
    print(f"Running evaluation on {len(questions)} questions...\n")

    results = []
    retrieval_hits   = 0
    citation_hits    = 0
    grounded_count   = 0
    retry_count_total = 0

    for i, q in enumerate(questions):
        print(f"[{i+1}/{len(questions)}] Q{q['id']}: {q['question_km'][:50]}...")

        start = time.time()
        try:
            state = run_single_query(q["question_km"])
            elapsed = round(time.time() - start, 2)

            r_hit = check_retrieval_hit(
                state.get("retrieved_chunks", []),
                q["expected_articles"]
            )
            c_hit = check_citation_hit(
                state.get("citations", []),
                q["expected_articles"]
            )

            if r_hit:   retrieval_hits   += 1
            if c_hit:   citation_hits    += 1
            if state.get("is_grounded"): grounded_count += 1
            retry_count_total += state.get("retry_count", 0)

            result = {
                "id":               q["id"],
                "category":         q["category"],
                "difficulty":       q["difficulty"],
                "question_km":      q["question_km"],
                "expected_articles":q["expected_articles"],
                "expected_law":     q["expected_law"],
                "key_facts":        q["key_facts"],
                "answer":           state.get("final_answer", ""),
                "citations":        state.get("citations", []),
                "retrieved_articles": [
                    c.get("article_number") for c in state.get("retrieved_chunks", [])
                ],
                "is_grounded":      state.get("is_grounded", False),
                "retry_count":      state.get("retry_count", 0),
                "retrieval_hit":    r_hit,
                "citation_hit":     c_hit,
                "elapsed_sec":      elapsed,
                # Manual scoring fields (fill in after reviewing)
                "faithfulness":     None,   # 1-5
                "relevance":        None,   # 1-5
                "completeness":     None,   # 1-5
            }

            print(f"  ✓ {elapsed}s | retrieval_hit={r_hit} | citation_hit={c_hit} | grounded={state.get('is_grounded')}")

        except Exception as e:
            print(f"  ✗ Error: {e}")
            result = {
                "id": q["id"], "category": q["category"],
                "difficulty": q["difficulty"],
                "question_km": q["question_km"],
                "expected_articles": q["expected_articles"],
                "error": str(e),
                "retrieval_hit": False,
                "citation_hit": False,
            }
            elapsed = round(time.time() - start, 2)

        results.append(result)

        # Be kind to the API — 5s gap prevents Vertex AI 429 rate limit errors
        if i < len(questions) - 1:
            time.sleep(5)

    # ── Save full results ─────────────────────────────────────────────────────
    n = len(questions)
    summary = {
        "total":             n,
        "retrieval_hits":    retrieval_hits,
        "citation_hits":     citation_hits,
        "grounded_count":    grounded_count,
        "precision_at_5":    round(retrieval_hits / n * 100, 1),
        "citation_accuracy": round(citation_hits  / n * 100, 1),
        "grounding_rate":    round(grounded_count / n * 100, 1),
        "avg_retries":       round(retry_count_total / n, 2),
        "results":           results,
    }

    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # ── Print summary ─────────────────────────────────────────────────────────
    lines = [
        "=" * 60,
        "EVALUATION SUMMARY",
        "=" * 60,
        f"Total questions  : {n}",
        f"Retrieval hits   : {retrieval_hits}/{n} ({summary['precision_at_5']}%)",
        f"Citation accuracy: {citation_hits}/{n}  ({summary['citation_accuracy']}%)",
        f"Grounding rate   : {grounded_count}/{n}  ({summary['grounding_rate']}%)",
        f"Avg retries/query: {summary['avg_retries']}",
        "",
        "Per-category breakdown:",
    ]

    by_category: dict = {}
    for r in results:
        cat = r.get("category", "unknown")
        if cat not in by_category:
            by_category[cat] = {"total": 0, "retrieval_hits": 0, "citation_hits": 0}
        by_category[cat]["total"] += 1
        if r.get("retrieval_hit"):  by_category[cat]["retrieval_hits"] += 1
        if r.get("citation_hit"):   by_category[cat]["citation_hits"]  += 1

    for cat, stats in by_category.items():
        t  = stats["total"]
        rh = stats["retrieval_hits"]
        ch = stats["citation_hits"]
        lines.append(f"  {cat:<28} retrieval={rh}/{t}  citation={ch}/{t}")

    lines += [
        "",
        "NOTE: Manual scoring (faithfulness/relevance/completeness)",
        "      should be filled in results.json after reviewing answers.",
        "=" * 60,
    ]

    summary_text = "\n".join(lines)
    print("\n" + summary_text)

    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(summary_text)

    print(f"\nFull results saved to: {results_path}")
    print(f"Summary saved to:      {summary_path}")


if __name__ == "__main__":
    main()
