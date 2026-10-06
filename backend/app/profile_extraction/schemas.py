from pydantic import BaseModel, ConfigDict, Field


class FindInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fact_keys: list[str] = Field(min_length=1, max_length=43)
    document_ids: list[str] = Field(min_length=1, max_length=50)


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    machine_id: str = Field(min_length=1)


class ApplyInput(ReviewInput):
    expected_profile_updated_at: str | None
