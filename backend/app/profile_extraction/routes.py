from fastapi import APIRouter
from app.machine_profiles.routes import Database
from . import service
from .schemas import FindInput, ApplyInput, ReviewInput

router = APIRouter(prefix="/api", tags=["Targeted Profile Extraction"])


@router.get("/machines/{machine_id}/profile/extraction-documents")
def sources(machine_id: str, db: Database):
    return service.eligible_documents(db, machine_id)


@router.post("/machines/{machine_id}/profile/find-information")
def find(machine_id: str, data: FindInput, db: Database):
    return service.find_information(db, machine_id, data)


@router.get("/machines/{machine_id}/profile/candidates")
def candidates(machine_id: str, db: Database, run_id: str | None = None):
    return service.get_run(db, machine_id, run_id)


@router.post("/profile-candidates/{candidate_id}/apply")
def apply(candidate_id: str, data: ApplyInput, db: Database):
    return service.review_candidate(
        db, candidate_id, data.machine_id, "APPLIED", data.expected_profile_updated_at
    )


@router.post("/profile-candidates/{candidate_id}/reject")
def reject(candidate_id: str, data: ReviewInput, db: Database):
    return service.review_candidate(db, candidate_id, data.machine_id, "REJECTED")
