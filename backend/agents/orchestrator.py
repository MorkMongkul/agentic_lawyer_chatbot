# backend/agents/orchestrator.py
"""
LangGraph agentic RAG orchestrator.

Flow:
  classify_intent
      ├── legal_qa / definition  → rewrite_query → retrieve → ground_check → generate
      ├── article_lookup         → direct_lookup → generate
      ├── recent_news            → generate (with disclaimer, no retrieval)
      └── greeting               → generate (direct, no retrieval)
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END


# ── Agent state — shared across all nodes ────────────────────────────────────

class AgentState(TypedDict):
    # Input
    user_query:        str
    session_id:        str
    conversation_history: list[dict]   # last N turns from DB

    # Intent
    intent:            str             # legal_qa | article_lookup | recent_news | greeting
    article_number:    str | None      # populated for article_lookup intent

    # Retrieval
    rewritten_query:   str
    retrieved_chunks:  list[dict]
    is_grounded:       bool
    retry_count:       int

    # Output
    final_answer:      str
    citations:         list[dict]
    used_web_search:   bool            # True = show disclaimer in frontend


# ── Import all node functions ─────────────────────────────────────────────────

from agents.intent_classifier import classify_intent_node
from agents.query_rewriter    import rewrite_query_node
from agents.retrieval_agent   import retrieve_node, direct_lookup_node
from agents.grounding_agent   import grounding_node
from agents.response_agent    import generate_node


# ── Routing functions ─────────────────────────────────────────────────────────

def route_by_intent(state: AgentState) -> str:
    """After intent classification, decide which path to take."""
    intent = state["intent"]
    if intent == "article_lookup":
        return "direct_lookup"
    elif intent in ("legal_qa", "definition"):
        return "rewrite_query"
    else:
        # greeting / recent_news → go straight to generate
        return "generate"

def route_after_grounding(state: AgentState) -> str:
    """
    After grounding check:
      - If relevant chunks found → generate
      - If not relevant AND retries left → rewrite again
      - If not relevant AND max retries → generate anyway (with low-confidence note)
    """
    if state["is_grounded"]:
        return "generate"
    if state["retry_count"] < 2:
        return "rewrite_query"
    return "generate"   # give up retrying, generate with what we have


# ── Build the graph ───────────────────────────────────────────────────────────

def build_agent_graph():
    graph = StateGraph(AgentState)

    # Add all nodes
    graph.add_node("classify_intent", classify_intent_node)
    graph.add_node("rewrite_query",   rewrite_query_node)
    graph.add_node("retrieve",        retrieve_node)
    graph.add_node("direct_lookup",   direct_lookup_node)
    graph.add_node("ground_check",    grounding_node)
    graph.add_node("generate",        generate_node)

    # Entry point
    graph.set_entry_point("classify_intent")

    # Intent → branch
    graph.add_conditional_edges(
        "classify_intent",
        route_by_intent,
        {
            "rewrite_query": "rewrite_query",
            "direct_lookup": "direct_lookup",
            "generate":      "generate",
        }
    )

    # Linear: rewrite → retrieve → ground check
    graph.add_edge("rewrite_query", "retrieve")
    graph.add_edge("retrieve",      "ground_check")

    # Direct lookup skips retrieval, goes straight to generate
    graph.add_edge("direct_lookup", "generate")

    # Ground check → either retry or generate
    graph.add_conditional_edges(
        "ground_check",
        route_after_grounding,
        {
            "generate":     "generate",
            "rewrite_query": "rewrite_query",
        }
    )

    # Generate → done
    graph.add_edge("generate", END)

    return graph.compile()


# Singleton — compiled once, reused for every request
agent_graph = build_agent_graph()