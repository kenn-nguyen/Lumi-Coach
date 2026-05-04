from app.services.cover_letter import build_prompt2_strategy_context


def test_prompt2_strategy_context_includes_structured_instruction_and_anchor() -> None:
    context = build_prompt2_strategy_context(
        {
            "positioning_thesis": "Lead with risk-platform proof.",
            "top_resume_goals": [
                "Show identity-risk relevance",
                "Make outcomes easy to skim",
                "Keep gaps out of body copy",
            ],
            "excitement_anchor": {
                "claim": "Scaled risk-platform workflows",
                "evidence": "Associate Director role, 2022, approval funnel proof",
                "placement": "both",
                "why_distinctive": "Combines platform ownership with measurable risk outcomes",
            },
            "bullet_rewrite_instructions": [
                {
                    "role": "Associate Director of Product",
                    "instruction": {
                        "primary_message": "Show ownership of identity-risk workflows",
                        "primary_metric": "approval rate lift",
                        "mechanism": "sequenced rollout priorities",
                        "optional_context": "for B2B customers",
                        "do_not_include": ["unsupported fraud-specialist title"],
                    },
                }
            ],
        },
        role_title="Associate Director of Product",
    )

    assert "Excitement anchor: Scaled risk-platform workflows" in context
    assert "message: Show ownership of identity-risk workflows" in context
    assert "metric: approval rate lift" in context
    assert "omit: unsupported fraud-specialist title" in context
