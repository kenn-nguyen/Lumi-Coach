"""Delete legacy ownerless TinyDB records after auth rollout.

Run this once before a public launch if you want to remove pre-SSO records
that were never associated with a signed-in user.
"""

from app.database import db


def main() -> None:
    removed = db.clear_unowned_records()
    print("Removed ownerless records:")
    print(f"  resumes: {removed['resumes']}")
    print(f"  jobs: {removed['jobs']}")
    print(f"  improvements: {removed['improvements']}")


if __name__ == "__main__":
    main()
