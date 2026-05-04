from app.schemas import ResumeData


def test_work_experience_context_is_preserved_when_present() -> None:
    data = ResumeData.model_validate(
        {
            "personalInfo": {
                "name": "Hung Nguyen",
                "title": "Product Manager",
                "customTagline": None,
                "email": "hung@example.com",
                "phone": "555-0100",
                "location": "Seattle, WA",
                "website": None,
                "linkedin": None,
                "github": None,
            },
            "summary": "Product leader with marketplace experience.",
            "workExperience": [
                {
                    "id": 1,
                    "title": "Senior Product Manager Technical",
                    "company": "Amazon.com",
                    "location": "Seattle, WA",
                    "context": "Helping sellers list products on Amazon by connecting them with labs",
                    "years": "2022 - 2023",
                    "description": [
                        "Drove product vision for product testing services",
                    ],
                }
            ],
            "education": [],
            "personalProjects": [],
            "additional": {
                "technicalSkills": [],
                "languages": [],
                "certificationsTraining": [],
                "awards": [],
            },
            "sectionMeta": [],
            "customSections": {},
        }
    ).model_dump()

    assert (
        data["workExperience"][0]["context"]
        == "Helping sellers list products on Amazon by connecting them with labs"
    )


def test_work_experience_context_defaults_to_none_when_missing() -> None:
    data = ResumeData.model_validate(
        {
            "workExperience": [
                {
                    "id": 1,
                    "title": "Founder",
                    "company": "Epeak",
                    "location": "Chicago, IL",
                    "years": "2020 - 2021",
                    "description": ["Validated an ed-tech marketplace concept"],
                }
            ],
        }
    ).model_dump()

    assert data["workExperience"][0]["context"] is None
